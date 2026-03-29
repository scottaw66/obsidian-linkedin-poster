import { MarkdownView, Notice, Plugin, requestUrl } from "obsidian";
import {
  DEFAULT_SETTINGS,
  LinkedInPosterSettingTab,
  type LinkedInPosterSettings,
} from "./settings";
import { LinkedInApi, type HttpRequestFn } from "./linkedin/api";
import {
  startOAuthFlow,
  refreshAccessToken,
  isTokenExpiringSoon,
} from "./linkedin/auth";
import type { LinkedInTokenData } from "./linkedin/types";
import { UrlInputModal, createLinkedInPost } from "./commands/new-post";
import {
  parseActiveNote,
  PreviewModal,
  publishPost,
} from "./commands/publish-post";
import { markdownToLinkedIn } from "./utils/markdown";

const SECRET_KEY = "linkedin-poster-tokens";

export default class LinkedInPosterPlugin extends Plugin {
  settings: LinkedInPosterSettings;
  private tokenData: LinkedInTokenData | null = null;
  private api: LinkedInApi;
  private httpRequest: HttpRequestFn;

  async onload(): Promise<void> {
    await this.loadSettings();

    // Create HTTP transport using Obsidian's requestUrl (bypasses CORS)
    this.httpRequest = async (options) => {
      const response = await requestUrl({
        url: options.url,
        method: options.method,
        headers: options.headers,
        body: options.body,
      });
      return {
        status: response.status,
        headers: response.headers,
        text:
          typeof response.text === "string"
            ? response.text
            : JSON.stringify(response.json),
      };
    };
    this.api = new LinkedInApi(this.httpRequest);

    await this.loadTokens();

    // Command: New LinkedIn Post
    this.addCommand({
      id: "new-linkedin-post",
      name: "New LinkedIn Post",
      callback: () => {
        new UrlInputModal(this.app, async (url: string) => {
          await createLinkedInPost(
            this.app,
            url,
            this.settings.draftsFolder,
            this.settings.defaultTag,
            this.settings.defaultVisibility
          );
        }).open();
      },
    });

    // Command: Post to LinkedIn
    this.addCommand({
      id: "post-to-linkedin",
      name: "Post to LinkedIn",
      checkCallback: (checking: boolean) => {
        const view =
          this.app.workspace.getActiveViewOfType(MarkdownView);
        if (!view) return false;
        if (checking) return true;
        this.handlePublish();
        return true;
      },
    });

    // Command: Connect LinkedIn Account
    this.addCommand({
      id: "connect-linkedin",
      name: "Connect LinkedIn Account",
      callback: () => {
        this.connectLinkedIn();
      },
    });

    this.addSettingTab(new LinkedInPosterSettingTab(this.app, this));
  }

  // --- Auth ---

  isConnected(): boolean {
    return this.tokenData !== null;
  }

  async connectLinkedIn(): Promise<void> {
    if (!this.settings.clientId || !this.settings.clientSecret) {
      new Notice(
        "Please enter your Client ID and Client Secret in settings first."
      );
      return;
    }

    new Notice("Opening LinkedIn authorization in your browser...");

    startOAuthFlow(this.settings.clientId, this.settings.clientSecret, {
      openUrl: (url: string) => {
        window.open(url);
      },
      onSuccess: async (tokenData: LinkedInTokenData) => {
        this.tokenData = tokenData;
        await this.saveTokens();

        // Cache display name
        try {
          const userInfo = await this.api.getUserInfo(
            tokenData.accessToken
          );
          this.settings.connectedName = userInfo.name;
          await this.saveSettings();
        } catch {
          this.settings.connectedName = "Unknown";
          await this.saveSettings();
        }

        new Notice("LinkedIn connected!");
      },
      onError: (error: string) => {
        new Notice(`LinkedIn connection failed: ${error}`);
      },
      httpRequest: this.httpRequest,
      getUserInfo: async (accessToken: string) => {
        const info = await this.api.getUserInfo(accessToken);
        return { sub: info.sub, name: info.name };
      },
    });
  }

  async disconnect(): Promise<void> {
    this.tokenData = null;
    this.settings.connectedName = "";
    await this.app.secretStorage.setSecret(SECRET_KEY, "");
    await this.saveSettings();
    new Notice("LinkedIn disconnected.");
  }

  private async getValidAccessToken(): Promise<string | null> {
    if (!this.tokenData) {
      new Notice(
        "Not connected to LinkedIn. Use 'Connect LinkedIn Account' command."
      );
      return null;
    }

    if (isTokenExpiringSoon(this.tokenData.expiresAt)) {
      if (Date.now() >= this.tokenData.refreshExpiresAt) {
        new Notice(
          "LinkedIn session expired. Please reconnect in settings."
        );
        return null;
      }

      try {
        const newTokenData = await refreshAccessToken(
          this.tokenData.refreshToken,
          this.settings.clientId,
          this.settings.clientSecret,
          this.httpRequest
        );
        newTokenData.personUrn = this.tokenData.personUrn;
        this.tokenData = newTokenData;
        await this.saveTokens();
      } catch {
        new Notice(
          "Failed to refresh LinkedIn token. Please reconnect in settings."
        );
        return null;
      }
    }

    return this.tokenData.accessToken;
  }

  // --- Publish ---

  private async handlePublish(): Promise<void> {
    const postData = parseActiveNote(
      this.app,
      this.settings.defaultVisibility
    );
    if (!postData) return;

    if (postData.status === "posted") {
      new Notice(
        "This post has already been published. Change status to 'draft' to re-post."
      );
      return;
    }

    const accessToken = await this.getValidAccessToken();
    if (!accessToken) return;

    const processedText = markdownToLinkedIn(postData.body);

    if (this.settings.showPreview) {
      new PreviewModal(
        this.app,
        postData,
        processedText,
        async () => {
          await publishPost(
            this.app,
            this.api,
            accessToken,
            this.tokenData!.personUrn,
            postData,
            this.settings.publishedFolder
          );
        }
      ).open();
    } else {
      try {
        await publishPost(
          this.app,
          this.api,
          accessToken,
          this.tokenData!.personUrn,
          postData,
          this.settings.publishedFolder
        );
      } catch (err) {
        new Notice(
          `Failed to post: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }
  }

  // --- Token Storage ---

  private async loadTokens(): Promise<void> {
    try {
      const raw = await this.app.secretStorage.getSecret(SECRET_KEY);
      if (raw) {
        this.tokenData = JSON.parse(raw) as LinkedInTokenData;
      }
    } catch {
      this.tokenData = null;
    }
  }

  private async saveTokens(): Promise<void> {
    if (this.tokenData) {
      await this.app.secretStorage.setSecret(
        SECRET_KEY,
        JSON.stringify(this.tokenData)
      );
    }
  }

  // --- Settings ---

  async loadSettings(): Promise<void> {
    this.settings = Object.assign(
      {},
      DEFAULT_SETTINGS,
      (await this.loadData()) as Partial<LinkedInPosterSettings>
    );
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  showNotice(message: string): void {
    new Notice(message);
  }
}
