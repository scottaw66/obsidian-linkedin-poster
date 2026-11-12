/**
 * Convert Obsidian Markdown to LinkedIn-compatible text.
 * LinkedIn supports: **bold**, *italic*, lists (- and 1.)
 * LinkedIn does NOT support: headings, links, images, code blocks
 */
export function markdownToLinkedIn(text: string): string {
  let result = text;

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
