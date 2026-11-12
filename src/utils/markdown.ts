/**
 * Remove Obsidian comments (%% ... %%) from text. Obsidian never renders them, so they are never
 * part of a post: this is what lets a draft carry notes to write from (the linkedin-post link's
 * `notes`, added 2026-11-12) without publishing them. A %% with no closing %% comments out the
 * rest of the note in Obsidian, so everything after it is removed too.
 */
export function stripObsidianComments(text: string): string {
  return text.replace(/%%[\s\S]*?%%/g, "").replace(/%%[\s\S]*$/, "");
}

/**
 * Convert Obsidian Markdown to LinkedIn-compatible text.
 * LinkedIn supports: **bold**, *italic*, lists (- and 1.)
 * LinkedIn does NOT support: headings, links, images, code blocks
 */
export function markdownToLinkedIn(text: string): string {
  // Comments first: nothing inside one is ever posted (also done when the body is read, in
  // publish-post.ts, so the empty-post check sees a notes-only draft as empty).
  let result = stripObsidianComments(text);

  // Remove images: ![alt](url)
  result = result.replace(/!\[[^\]]*\]\([^)]+\)/g, "");

  // Convert links: [text](url) → text (url)
  result = result.replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1 ($2)");

  // Strip heading markers: ## Heading → Heading
  result = result.replace(/^#{1,6}\s+/gm, "");

  // Remove code blocks (``` ... ```) — keep inner text
  result = result.replace(/```[\s\S]*?```/g, (match) => {
    return match
      .replace(/```\w*\n?/g, "")
      .replace(/```/g, "")
      .trim();
  });

  // Strip inline code backticks
  result = result.replace(/`([^`]+)`/g, "$1");

  // Remove horizontal rules
  result = result.replace(/^[-*_]{3,}\s*$/gm, "");

  // Clean up excessive blank lines (more than 2 in a row)
  result = result.replace(/\n{3,}/g, "\n\n");

  return result.trim();
}
