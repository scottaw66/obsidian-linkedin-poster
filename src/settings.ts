import { App, PluginSettingTab, Setting } from "obsidian";
import type LinkedInPosterPlugin from "./main";

export interface LinkedInPosterSettings {
  clientId: string;
  clientSecret: string;
  postFolder: string;
  defaultTag: string;
  defaultVisibility: "public" | "connections";
  showPreview: boolean;
  connectedName: string;
}

export const DEFAULT_SETTINGS: LinkedInPosterSettings = {
  clientId: "",
  clientSecret: "",
  postFolder: "",
  defaultTag: "life/career/linkedin/posts",
  defaultVisibility: "public",
  showPreview: true,
  connectedName: "",
};

export class LinkedInPosterSettingTab extends PluginSettingTab {
  plugin: LinkedInPosterPlugin;

  constructor(app: App, plugin: LinkedInPosterPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl("h2", { text: "LinkedIn Poster Settings" });

    // --- LinkedIn App Credentials ---
    containerEl.createEl("h3", { text: "LinkedIn App" });

    new Setting(containerEl)
      .setName("Client ID")
      .setDesc("From your LinkedIn Developer Portal app")
      .addText((text) =>
        text
          .setPlaceholder("Enter Client ID")
          .setValue(this.plugin.settings.clientId)
          .onChange(async (value) => {
            this.plugin.settings.clientId = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Client Secret")
      .setDesc("From your LinkedIn Developer Portal app")
      .addText((text) => {
        text
          .setPlaceholder("Enter Client Secret")
          .setValue(this.plugin.settings.clientSecret)
          .onChange(async (value) => {
            this.plugin.settings.clientSecret = value;
            await this.plugin.saveSettings();
          });
        text.inputEl.type = "password";
      });

    // --- Connection Status ---
    containerEl.createEl("h3", { text: "Connection" });

    const isConnected = this.plugin.isConnected();
    const statusSetting = new Setting(containerEl)
      .setName("Status")
      .setDesc(
        isConnected
          ? `Connected as ${this.plugin.settings.connectedName}`
          : "Not connected"
      );

    if (isConnected) {
      statusSetting.addButton((button) =>
        button
          .setButtonText("Disconnect")
          .setWarning()
          .onClick(async () => {
            await this.plugin.disconnect();
            this.display();
          })
      );
    } else {
      statusSetting.addButton((button) =>
        button
          .setButtonText("Connect LinkedIn Account")
          .onClick(async () => {
            if (
              !this.plugin.settings.clientId ||
              !this.plugin.settings.clientSecret
            ) {
              this.plugin.showNotice(
                "Please enter your Client ID and Client Secret first."
              );
              return;
            }
            await this.plugin.connectLinkedIn();
            this.display();
          })
      );
    }

    // --- Post Defaults ---
    containerEl.createEl("h3", { text: "Post Defaults" });

    new Setting(containerEl)
      .setName("Post folder")
      .setDesc("Folder where new LinkedIn post notes are created")
      .addText((text) =>
        text
          .setPlaceholder("e.g. LinkedIn Posts")
          .setValue(this.plugin.settings.postFolder)
          .onChange(async (value) => {
            this.plugin.settings.postFolder = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Default tag")
      .setDesc("Tag applied to new post notes")
      .addText((text) =>
        text
          .setValue(this.plugin.settings.defaultTag)
          .onChange(async (value) => {
            this.plugin.settings.defaultTag = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Default visibility")
      .setDesc(
        "Who can see your posts (can be overridden per-post in frontmatter)"
      )
      .addDropdown((dropdown) =>
        dropdown
          .addOption("public", "Public")
          .addOption("connections", "Connections only")
          .setValue(this.plugin.settings.defaultVisibility)
          .onChange(async (value: string) => {
            this.plugin.settings.defaultVisibility = value as
              | "public"
              | "connections";
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Show preview before posting")
      .setDesc("Show a preview modal before publishing to LinkedIn")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.showPreview)
          .onChange(async (value) => {
            this.plugin.settings.showPreview = value;
            await this.plugin.saveSettings();
          })
      );
  }
}
