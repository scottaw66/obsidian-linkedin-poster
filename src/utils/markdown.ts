/**
 * Convert Obsidian Markdown to the plain text a LinkedIn post shows. This is what the preview
 * displays; utils/little.ts then escapes it into the API's `commentary` format.
 * LinkedIn posts have no formatting of their own: no headings, links, images, code, bold or
 * italic. Bold and italic markers (* and _) are left in and show as typed (the little format has
 * no bold or italic element; checked in LinkedIn's docs 2026-11-19). Lists (- and 1.) are plain
 * text and read fine.
 */
export function markdownToLinkedIn(text: string): string {
  let result = text;

  // Remove images and embeds: ![alt](url), ![[file]]
  result = result.replace(/!\[[^\]]*\]\([^)]+\)/g, "");
  result = result.replace(/!\[\[[^\]]*\]\]/g, "");

  // Wikilinks show as their text, the way Obsidian shows them:
  // [[Note|alias]] → alias, [[Note]] → Note, [[Note#Heading]] → Note > Heading
  result = result.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_m, target: string, alias?: string) =>
    alias !== undefined ? alias.trim() : target.trim().replace(/#/g, " > ")
  );

  // Convert links: [text](url) → text (url), or just url when the text is the url itself
  result = result.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, label: string, url: string) =>
    label.trim() === url ? url : `${label} (${url})`
  );

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
