# LinkedIn Poster for Obsidian

An Obsidian plugin that lets you compose and publish LinkedIn posts directly from your notes. Write your thoughts in a note, hit a command, and it's posted — no switching apps.

## Features

- **Note-based workflow:** Each LinkedIn post is an Obsidian note with frontmatter tracking metadata
- **URL sharing:** Paste a URL and the plugin fetches the page title, creates a note, and attaches the link as a LinkedIn article preview
- **Text-only posts:** Skip the URL for thought-leadership posts
- **Preview before posting:** See exactly what will be published, with character count (3,000 max)
- **Markdown conversion:** Automatically converts Obsidian Markdown to LinkedIn-compatible formatting
- **Frontmatter tracking:** Status, post date, LinkedIn URL, tags, and visibility are all tracked per-note
- **Secure token storage:** OAuth tokens stored in Obsidian's SecretStorage (not in your vault files)
- **Auto token refresh:** Access tokens are refreshed automatically before they expire

## Installation

### Manual Install

1. Download the [latest release](../../releases) (or build from source — see below)
2. Copy `main.js`, `manifest.json`, and `styles.css` into your vault at `.obsidian/plugins/linkedin-poster/`
3. In Obsidian, go to **Settings → Community plugins** and enable **LinkedIn Poster**

### Build from Source

```bash
git clone https://github.com/scottaw66/obsidian-linkedin-poster.git
cd obsidian-linkedin-poster
bun install    # or npm install
bun run build  # or npm run build
```

Then copy `main.js`, `manifest.json`, and `styles.css` to your vault's `.obsidian/plugins/linkedin-poster/` directory.

## Setup

### 1. Create a LinkedIn Developer App

1. Create a [LinkedIn Company Page](https://www.linkedin.com/company/setup/new/) (required by LinkedIn for developer apps, even for personal use — it can be minimal)
2. Go to [LinkedIn Developer Portal](https://www.linkedin.com/developers/apps) and create a new app
3. Associate the app with your Company Page
4. Under **Products**, add both:
   - **Share on LinkedIn** (grants `w_member_social` — needed to create posts)
   - **Sign In with LinkedIn using OpenID Connect** (grants `openid`, `profile` — needed to identify your account)
5. Under **Auth → OAuth 2.0 settings**, add this redirect URI: `http://127.0.0.1:48734/callback`
6. Verify on the **Auth** tab that all four scopes appear: `openid`, `profile`, `w_member_social`, `email`

> **Important:** Both products are required. "Share on LinkedIn" alone does not provide a way to identify your account, and the plugin will fail to connect without "Sign In with LinkedIn using OpenID Connect."

### 2. Configure the Plugin

1. In Obsidian, go to **Settings → LinkedIn Poster**
2. Enter your **Client ID** and **Client Secret** from the LinkedIn Developer Portal
3. Set your **Drafts folder** and **Published folder** (can be the same folder or separate — see Settings below)
4. Click **Connect LinkedIn Account** — a browser window will open for you to authorize
5. Once authorized, you'll see "Connected as [your name]" in settings

> **Troubleshooting auth:** If you add the Sign In product after your first connection attempt, LinkedIn may cache the old consent. Go to LinkedIn → **Settings → Data Privacy → Permitted Services**, remove the app, then reconnect from the plugin.

### Finding Your LinkedIn Member ID (for debugging)

The plugin discovers your identity automatically via OpenID Connect. If you ever need your numeric LinkedIn Member ID for debugging purposes, open your LinkedIn profile in a browser, open the developer console, and run:

```js
fetch('/voyager/api/me',{headers:{'csrf-token':document.cookie.match(/JSESSIONID="?([^";]+)/)?.[1]}}).then(r=>r.text()).then(t=>prompt('ID',t.match(/li:member:(\d+)/)?.[1]||'none'))
```

This will display your numeric member ID in a prompt dialog.

## Usage

### Creating a New Post

1. Open the command palette (`Cmd/Ctrl + P`)
2. Run **"New LinkedIn Post"**
3. Enter a URL to share (or leave empty for a text-only post)
4. A new note is created in your drafts folder with pre-filled frontmatter
5. Write your commentary in the note body

### Publishing

1. With your post note open, open the command palette
2. Run **"Post to LinkedIn"**
3. Review the preview (if enabled) — shows processed text, character count, and visibility
4. Click **"Post to LinkedIn"** in the preview modal
5. The note's frontmatter is updated with the post date and LinkedIn URL, and the note is moved to your published folder

### Note Format

Notes are created with this structure:

```markdown
---
url: "https://example.com/article"
status: draft
tags: life/career/linkedin/posts
visibility: public
posted_date:
linkedin_url:
---

Your commentary here...
```

After posting, the frontmatter is automatically updated:

```markdown
---
url: "https://example.com/article"
status: posted
tags: life/career/linkedin/posts
visibility: public
posted_date: 2026-03-28T19:30:00.000Z
linkedin_url: https://www.linkedin.com/feed/update/urn:li:share:7012345678901234567
---
```

## Settings

| Setting | Default | Description |
|---------|---------|-------------|
| **Client ID** | — | LinkedIn app Client ID from the Developer Portal |
| **Client Secret** | — | LinkedIn app Client Secret from the Developer Portal |
| **Drafts folder** | — | Folder where new post notes are created |
| **Published folder** | — | Folder where posts are moved after publishing. Can be the same as drafts folder if you don't want separation. |
| **Default tag** | `life/career/linkedin/posts` | Tag applied to new post notes in frontmatter |
| **Default visibility** | `public` | `public` or `connections` — can be overridden per-post in frontmatter |
| **Show preview before posting** | On | Display a preview modal with the processed text before publishing |

## Commands

| Command | Description |
|---------|-------------|
| **New LinkedIn Post** | Create a new post note (prompts for optional URL) |
| **Post to LinkedIn** | Publish the active note to LinkedIn |
| **Connect LinkedIn Account** | Start the OAuth authorization flow |

## Markdown Conversion

LinkedIn supports limited formatting. The plugin automatically converts your Markdown:

| Markdown | Result | Notes |
|----------|--------|-------|
| `**bold**` | **bold** | Kept as-is — LinkedIn supports this |
| `*italic*` | *italic* | Kept as-is |
| `- item` / `1. item` | Lists | Kept as-is |
| `# Heading` | Heading | `#` prefix stripped, text kept |
| `[text](url)` | text (url) | Link syntax converted to plain text |
| `![alt](img)` | *(removed)* | Images removed entirely |
| `` `code` `` | code | Backticks stripped |
| Code blocks | Plain text | Fences removed, content kept |

## Token Management

- **Access tokens** last 60 days and are refreshed automatically when within 7 days of expiry
- **Refresh tokens** last 365 days — if expired, you'll be prompted to reconnect
- All tokens are stored in Obsidian's [SecretStorage](https://docs.obsidian.md/Plugins/User+interface/Secret+storage) — they never appear in your vault files or sync

## Requirements

- Obsidian v1.11.4 or later (for SecretStorage API)
- Desktop only (the OAuth flow uses a local HTTP server)

## License

MIT
