import { App, MarkdownView, Modal, Notice, Setting, normalizePath } from "obsidian";
import { fetchPageTitle, sanitizeFilename } from "../utils/metadata";

export class UrlInputModal extends Modal {
  private url = "";
  private onSubmit: (url: string) => void;

  constructor(app: App, onSubmit: (url: string) => void) {
    super(app);
    this.onSubmit = onSubmit;
  }

  onOpen(): void {
    const { contentEl } = this;

    contentEl.createEl("h2", { text: "New LinkedIn Post" });

    new Setting(contentEl)
      .setName("URL")
      .setDesc("Enter a URL to share, or leave empty for a text-only post")
      .addText((text) => {
        text.setPlaceholder("https://...");
        text.onChange((value) => {
          this.url = value.trim();
        });
        text.inputEl.addEventListener("keydown", (e: KeyboardEvent) => {
          if (e.key === "Enter") {
            e.preventDefault();
            this.submit();
          }
        });
        setTimeout(() => text.inputEl.focus(), 10);
      });

    new Setting(contentEl).addButton((button) =>
      button.setButtonText("Create Post").setCta().onClick(() => this.submit())
    );
  }

  private submit(): void {
    this.close();
    this.onSubmit(this.url);
  }

  onClose(): void {
    this.contentEl.empty();
  }
}

const MAX_NOTES = 8000;

/**
 * Notes to write from, as plain text at the top of the draft's body (Scott, 2026-11-12: "i just want
 * them put in the body of the new note. that simple. *I* will edit them out"). They are ordinary
 * body text: whatever is still there at publish time is posted, like anything else in the note.
 * A first version the same day hid them in an Obsidian comment, which Reading view doesn't show,
 * so the draft looked empty.
 */
function notesBlock(notes: string): string {
  const text = notes.trim().slice(0, MAX_NOTES);
  return text ? `${text}\n\n` : "";
}

export async function createLinkedInPost(
  app: App,
  url: string,
  draftsFolder: string,
  defaultTag: string,
  defaultVisibility: string,
  notes = ""
): Promise<void> {
  if (!draftsFolder) {
    new Notice("Please configure a drafts folder in LinkedIn Poster settings.");
    return;
  }

  // Ensure folder exists
  const folderPath = normalizePath(draftsFolder);
  const folder = app.vault.getAbstractFileByPath(folderPath);
  if (!folder) {
    await app.vault.createFolder(folderPath);
  }

  // Determine filename
  const dateStr = new Date().toISOString().split("T")[0];
  let title = "LinkedIn Post";
  if (url) {
    const fetchedTitle = await fetchPageTitle(url);
    if (fetchedTitle && fetchedTitle !== "LinkedIn Post") {
      title = sanitizeFilename(fetchedTitle);
    }
  }

  // Handle duplicate filenames
  let filename = `${dateStr} ${title}`;
  let filePath = normalizePath(`${folderPath}/${filename}.md`);
  let counter = 1;
  while (app.vault.getAbstractFileByPath(filePath)) {
    filename = `${dateStr} ${title} ${counter}`;
    filePath = normalizePath(`${folderPath}/${filename}.md`);
    counter++;
  }

  // Build frontmatter
  const urlLine = url ? `url: "${url}"` : "url:";
  const content = `---
${urlLine}
status: draft
tags: ${defaultTag}
visibility: ${defaultVisibility}
posted_date:
linkedin_url:
---

${notesBlock(notes)}`;

  // Create and open the note
  const file = await app.vault.create(filePath, content);
  const leaf = app.workspace.getLeaf(false);
  await leaf.openFile(file);

  // Position cursor after frontmatter
  const view = app.workspace.getActiveViewOfType(MarkdownView);
  if (view) {
    const editor = view.editor;
    const lastLine = editor.lastLine();
    editor.setCursor({ line: lastLine, ch: 0 });
  }

  new Notice(`Created LinkedIn post: ${filename}`);
}
