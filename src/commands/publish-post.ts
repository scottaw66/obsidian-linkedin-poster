import { App, MarkdownView, Modal, Notice, Setting, TFile, normalizePath } from "obsidian";
import { markdownToLinkedIn } from "../utils/markdown";
import { commentaryFor } from "../utils/little";
import type { LinkedInApi } from "../linkedin/api";

const MAX_CHARS = 3000;

export interface PostData {
  body: string;
  url: string;
  visibility: "PUBLIC" | "CONNECTIONS";
  status: string;
  file: TFile;
}

export function parseActiveNote(
  app: App,
  defaultVisibility: string
): PostData | null {
  const view = app.workspace.getActiveViewOfType(MarkdownView);
  if (!view || !view.file) {
    new Notice("No active note open.");
    return null;
  }

  const file = view.file;
  const cache = app.metadataCache.getFileCache(file);
  const frontmatter = cache?.frontmatter;

  if (!frontmatter) {
    new Notice("This note has no frontmatter. Is it a LinkedIn post note?");
    return null;
  }

  // Get body text (everything after frontmatter)
  const content = view.editor.getValue();
  const frontmatterEnd = cache?.frontmatterPosition?.end?.line;
  if (frontmatterEnd === undefined) {
    new Notice("Could not parse frontmatter.");
    return null;
  }

  const lines = content.split("\n");
  const body = lines.slice(frontmatterEnd + 1).join("\n").trim();

  if (!body) {
    new Notice("Post body is empty. Write some content first.");
    return null;
  }

  const rawVisibility = (
    frontmatter.visibility || defaultVisibility
  ).toLowerCase();
  const visibility: "PUBLIC" | "CONNECTIONS" =
    rawVisibility === "connections" ? "CONNECTIONS" : "PUBLIC";

  return {
    body,
    url: frontmatter.url || "",
    visibility,
    status: frontmatter.status || "draft",
    file,
  };
}

export class PreviewModal extends Modal {
  private postData: PostData;
  private processedText: string;
  private onPost: () => Promise<void>;

  constructor(
    app: App,
    postData: PostData,
    processedText: string,
    onPost: () => Promise<void>
  ) {
    super(app);
    this.postData = postData;
    this.processedText = processedText;
    this.onPost = onPost;
  }

  onOpen(): void {
    const { contentEl } = this;

    contentEl.createEl("h2", { text: "LinkedIn Post Preview" });

    // URL info
    if (this.postData.url) {
      const urlEl = contentEl.createEl("div", {
        cls: "linkedin-preview-url",
      });
      urlEl.createEl("strong", { text: "Link: " });
      urlEl.createEl("span", { text: this.postData.url });
    }

    // Visibility
    const visEl = contentEl.createEl("div", {
      cls: "linkedin-preview-meta",
    });
    visEl.createEl("strong", { text: "Visibility: " });
    visEl.createEl("span", {
      text:
        this.postData.visibility === "PUBLIC"
          ? "Public"
          : "Connections only",
    });

    // Character count
    const charCount = this.processedText.length;
    const charEl = contentEl.createEl("div", {
      cls: "linkedin-preview-meta",
    });
    charEl.createEl("strong", { text: "Characters: " });
    const countSpan = charEl.createEl("span", {
      text: `${charCount}/${MAX_CHARS}`,
    });
    if (charCount > MAX_CHARS) {
      countSpan.addClass("linkedin-preview-over-limit");
    }

    // Preview text
    const previewEl = contentEl.createEl("div", {
      cls: "linkedin-preview-text",
    });
    previewEl.createEl("pre", { text: this.processedText });

    // Buttons
    const buttonRow = new Setting(contentEl);
    buttonRow.addButton((button) =>
      button.setButtonText("Cancel").onClick(() => this.close())
    );

    if (charCount <= MAX_CHARS) {
      buttonRow.addButton((button) =>
        button
          .setButtonText("Post to LinkedIn")
          .setCta()
          .onClick(async () => {
            button.setDisabled(true);
            button.setButtonText("Posting...");
            try {
              await this.onPost();
              this.close();
            } catch (err) {
              button.setDisabled(false);
              button.setButtonText("Post to LinkedIn");
              new Notice(
                `Failed to post: ${err instanceof Error ? err.message : String(err)}`
              );
            }
          })
      );
    }
  }

  onClose(): void {
    this.contentEl.empty();
  }
}

/**
 * One line of the post log (post-log.jsonl in the plugin's folder), written for every attempt to
 * post, whether it worked or not. LinkedIn won't let this app read a post back (that needs the
 * r_member_social permission, which LinkedIn gives to approved partners only; checked 2026-11-19),
 * so this is the record of exactly what was sent.
 */
interface PostLogEntry {
  time: string;
  note: string;
  visibility: string;
  articleUrl: string;
  /** The text the preview showed: what LinkedIn should display. */
  text: string;
  /** The `commentary` value actually sent (text escaped for LinkedIn), or null if not sent. */
  commentary: string | null;
  httpStatus: number | null;
  postUrn: string | null;
  error: string | null;
}

async function appendPostLog(app: App, logPath: string | undefined, entry: PostLogEntry): Promise<void> {
  console.info("LinkedIn Poster:", entry);
  if (!logPath) return;
  try {
    const line = JSON.stringify(entry) + "\n";
    if (await app.vault.adapter.exists(logPath)) await app.vault.adapter.append(logPath, line);
    else await app.vault.adapter.write(logPath, line);
  } catch (err) {
    console.error("LinkedIn Poster: could not write the post log", err);
  }
}

export async function publishPost(
  app: App,
  api: LinkedInApi,
  accessToken: string,
  personUrn: string,
  postData: PostData,
  publishedFolder?: string,
  logPath?: string
): Promise<void> {
  const processedText = markdownToLinkedIn(postData.body);

  if (processedText.length > MAX_CHARS) {
    new Notice(
      `Post is ${processedText.length} characters — max is ${MAX_CHARS}. Please shorten it.`
    );
    return;
  }

  const entry: PostLogEntry = {
    time: new Date().toISOString(),
    note: postData.file.path,
    visibility: postData.visibility,
    articleUrl: postData.url,
    text: processedText,
    commentary: null,
    httpStatus: null,
    postUrn: null,
    error: null,
  };

  // Escape LinkedIn's reserved characters; an unescaped "(" cut the 2026-11-19 post off.
  let commentary: string;
  try {
    commentary = commentaryFor(processedText);
  } catch (err) {
    entry.error = err instanceof Error ? err.message : String(err);
    await appendPostLog(app, logPath, entry);
    throw err;
  }
  entry.commentary = commentary;

  const result = await api.createPost(
    accessToken,
    personUrn,
    commentary,
    postData.visibility,
    postData.url || undefined
  );

  entry.httpStatus = result.status ?? null;
  entry.postUrn = result.postUrn ?? null;
  entry.error = result.success ? null : result.error || "Unknown error";
  await appendPostLog(app, logPath, entry);

  if (!result.success) {
    throw new Error(result.error || "Unknown error");
  }

  // Update frontmatter
  await app.fileManager.processFrontMatter(postData.file, (frontmatter) => {
    frontmatter.status = "posted";
    frontmatter.posted_date = new Date().toISOString();
    if (result.postUrn) {
      frontmatter.linkedin_url = `https://www.linkedin.com/feed/update/${result.postUrn}`;
    }
  });

  // Move to published folder if different from current location
  if (publishedFolder) {
    const publishedPath = normalizePath(publishedFolder);
    const currentFolder = postData.file.parent?.path || "";
    if (publishedPath !== currentFolder) {
      // Ensure published folder exists
      if (!app.vault.getAbstractFileByPath(publishedPath)) {
        await app.vault.createFolder(publishedPath);
      }
      const newPath = normalizePath(`${publishedPath}/${postData.file.name}`);
      await app.fileManager.renameFile(postData.file, newPath);
    }
  }

  new Notice("Posted to LinkedIn!");
}
