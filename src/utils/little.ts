// No Obsidian imports — reusable outside Obsidian, and runnable by the tests under plain Node.

/**
 * LinkedIn's "little" text format, which the Posts API's `commentary` field is written in.
 * Docs (read 2026-11-19, version li-lms-2026-11):
 * https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/little-text-format
 *
 * The reserved characters are | { } @ [ ] ( ) < > # \ * _ ~ and the docs say "All reserved
 * characters need to be escaped with a backslash, even if those characters are not used in one of
 * the supported elements or templates." Observed 2026-11-19: the Java4Shell post went up with an
 * unescaped "(" and LinkedIn answered 201 but showed the post cut off right before that "(".
 * Double quotes are not reserved; that post's quotes came before the cut and were shown fine.
 */
export const RESERVED_CHARS = "|{}@[]()<>#\\*_~";

const RESERVED_RE = /[|{}@[\]()<>#\\*_~]/g;

/**
 * A hashtag, kept as a working LinkedIn hashtag: "#" at the start of the text or after whitespace or
 * an opening bracket or quote, followed by a word with at least one letter in it. So "#coding" and
 * "#zero_trust" are hashtags, but "C#", "#1" and the "#" in "https://example.com/page#part" are
 * plain text. Before 2026-11-19 nothing was escaped, so LinkedIn read a bare "#word" as a hashtag
 * on its own; this keeps that.
 */
const HASHTAG_RE = /(?<=^|[\s([{"'“‘])#([\p{L}\p{N}_]*\p{L}[\p{L}\p{N}_]*)/gu;

function escapeReserved(text: string): string {
  return text.replace(RESERVED_RE, (c) => "\\" + c);
}

/**
 * Plain post text → the `commentary` value to send. Every reserved character is escaped, except
 * hashtags, which are written as LinkedIn's hashtag template `{hashtag|\#|word}` (the form the docs
 * post with, and the form LinkedIn itself returns when a post is read back).
 *
 * Mentions are not supported: the plugin has no way to look up a member's or company's URN, so "@"
 * is always escaped and shows as typed.
 */
export function toLittleText(text: string): string {
  let out = "";
  let last = 0;
  for (const match of text.matchAll(HASHTAG_RE)) {
    const start = match.index ?? 0;
    const word = match[1] ?? "";
    out += escapeReserved(text.slice(last, start));
    out += `{hashtag|\\#|${escapeReserved(word)}}`;
    last = start + 1 + word.length;
  }
  return out + escapeReserved(text.slice(last));
}

export class LittleTextError extends Error {}

/**
 * The text LinkedIn will show for a `commentary` value, read by the grammar in the docs above.
 * Deliberately strict: it understands only what toLittleText writes (backslash escapes and the
 * hashtag template), and throws at the first reserved character that isn't escaped, since that's
 * where LinkedIn would cut the post off or misread it.
 */
export function fromLittleText(little: string): string {
  let out = "";
  let i = 0;
  const fail = (what: string): never => {
    const near = little.slice(Math.max(0, i - 20), i + 20);
    throw new LittleTextError(`${what} at position ${i}, near "${near}"`);
  };
  const readEscape = (): string => {
    const next = little[i + 1];
    if (next === undefined || !RESERVED_CHARS.includes(next)) fail("Backslash that escapes nothing");
    i += 2;
    return next as string;
  };

  while (i < little.length) {
    const c = little[i] as string;
    if (c === "\\") {
      out += readEscape();
    } else if (little.startsWith("{hashtag|", i)) {
      i += "{hashtag|".length;
      if (little.startsWith("\\#", i)) i += 2;
      else if (little[i] === "#" || little[i] === "＃") i += 1;
      else fail("Hashtag template without a hashtag sign");
      if (little[i] !== "|") fail("Hashtag template missing its second |");
      i += 1;
      let word = "";
      while (i < little.length && little[i] !== "}") {
        if (little[i] === "\\") word += readEscape();
        else if (RESERVED_CHARS.includes(little[i] as string)) fail("Unescaped reserved character in a hashtag");
        else word += little[i++];
      }
      if (little[i] !== "}") fail("Hashtag template never closed");
      i += 1;
      if (!word) fail("Empty hashtag");
      out += "#" + word;
    } else if (RESERVED_CHARS.includes(c)) {
      fail(`Unescaped reserved character "${c}"`);
    } else {
      out += c;
      i += 1;
    }
  }
  return out;
}

/**
 * The `commentary` to send for a post's text, checked: reading it back by the docs' grammar must
 * give exactly the text the preview showed, or this throws and nothing is posted.
 */
export function commentaryFor(text: string): string {
  const little = toLittleText(text);
  const shown = fromLittleText(little);
  if (shown !== text) {
    throw new LittleTextError("Escaped text would not read back as the post text; not posting.");
  }
  return little;
}
