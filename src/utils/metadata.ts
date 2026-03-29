import { requestUrl } from "obsidian";

export async function fetchPageTitle(url: string): Promise<string> {
  try {
    const response = await requestUrl({ url, method: "GET" });
    const html = response.text;

    // Try <title> tag first
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleMatch && titleMatch[1]) {
      return decodeHtmlEntities(titleMatch[1].trim());
    }

    // Try og:title meta tag
    const ogMatch = html.match(
      /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i
    );
    if (ogMatch && ogMatch[1]) {
      return decodeHtmlEntities(ogMatch[1].trim());
    }

    return "LinkedIn Post";
  } catch {
    return "LinkedIn Post";
  }
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, "/");
}

export function sanitizeFilename(name: string): string {
  return name
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .substring(0, 100);
}
