// Run with `bun run test` (or `npm test`): Node's own test runner, no test dependencies.
// Node runs these .ts files directly (it strips the types), which is why the imports name ".ts".

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  RESERVED_CHARS,
  commentaryFor,
  fromLittleText,
  toLittleText,
} from "../src/utils/little.ts";
import { markdownToLinkedIn } from "../src/utils/markdown.ts";

// The body of the 2026-11-19 post that LinkedIn cut off at "(" (the note in
// Writing/LinkedIn/Published), as the plugin turns it into post text.
const JAVA4SHELL = `Thanks to a bug in Java known as "Java4Shell", I learned this week that (according to Oracle, anyway) "Java is the world's thirst most popular programming language and powers about 90% of Fortunate 500 companies."

I genuinely had no idea there was still so much Java in the world. I never fell for the hype myself, but I also don't make a living as a programmer like all the people still using Java. I did take a Java course in college though, so consider me an expert! 😄

Anyway, the point of this is to say that Java4Shell does potentially affect many organizations, and anyone running Java should take a look at CVE-2026-114938 and consider patching ASAP.

Source: https://therecord.media/cisa-issues-java4shell-alert`;

test("the Java4Shell post: parentheses escaped, quotes and emoji untouched, reads back whole", () => {
  const little = commentaryFor(markdownToLinkedIn(JAVA4SHELL));
  assert.ok(little.includes("that \\(according to Oracle, anyway\\) \"Java is"));
  assert.ok(little.includes('known as "Java4Shell", I learned'));
  assert.ok(little.includes("an expert! 😄"));
  assert.equal(fromLittleText(little), JAVA4SHELL);
});

test("unescaped text is refused at the character where LinkedIn cut the post", () => {
  assert.throws(() => fromLittleText(JAVA4SHELL), /Unescaped reserved character "\("/);
});

test("every reserved character is escaped with a backslash and reads back as itself", () => {
  assert.equal(RESERVED_CHARS.length, 15);
  for (const c of RESERVED_CHARS) {
    const text = `a ${c} b${c}c`;
    const little = toLittleText(text);
    assert.equal(little, `a \\${c} b\\${c}c`, `escaping ${c}`);
    assert.equal(fromLittleText(little), text, `reading back ${c}`);
    assert.throws(() => fromLittleText(text), `an unescaped ${c} is refused`);
  }
});

test("double and single quotes, straight and curly, are not reserved", () => {
  const text = `"straight" 'single' “curly” ‘curly’ it's`;
  assert.equal(toLittleText(text), text);
  assert.equal(fromLittleText(text), text);
});

test("a backslash is escaped, and a stray one in the commentary is refused", () => {
  assert.equal(toLittleText("C:\\Users"), "C:\\\\Users");
  assert.throws(() => fromLittleText("C:\\Users"), /Backslash that escapes nothing/);
});

test("hashtags stay hashtags, written as LinkedIn's hashtag template", () => {
  assert.equal(toLittleText("Follow best practices #coding"), "Follow best practices {hashtag|\\#|coding}");
  assert.equal(toLittleText("#cybersecurity first"), "{hashtag|\\#|cybersecurity} first");
  assert.equal(toLittleText("(#AI)"), "\\({hashtag|\\#|AI}\\)");
  assert.equal(toLittleText("#zero_trust"), "{hashtag|\\#|zero\\_trust}");
  for (const text of ["#coding #AI", "(#AI)", "#zero_trust", "#Sécurité"]) {
    assert.equal(fromLittleText(toLittleText(text)), text);
  }
});

test("a # that isn't a hashtag is plain text", () => {
  assert.equal(toLittleText("C# and F#"), "C\\# and F\\#");
  assert.equal(toLittleText("#1 priority"), "\\#1 priority");
  assert.equal(toLittleText("https://example.com/page#part"), "https://example.com/page\\#part");
  assert.equal(toLittleText("a # b"), "a \\# b");
});

test("@ is always plain text (the plugin makes no mentions)", () => {
  assert.equal(toLittleText("keyv@6.0.0"), "keyv\\@6.0.0");
  assert.equal(toLittleText("@[Someone](urn:li:person:1)"), "\\@\\[Someone\\]\\(urn:li:person:1\\)");
});

test("text from earlier posts that also had reserved characters reads back whole", () => {
  const samples = [
    "It reads `~/.codex/auth.json` and ships the access_token, refresh_token, id_token",
    "Source: [https://thehackernews.com/2026/05/trapdoor.html](https://thehackernews.com/2026/05/trapdoor.html)",
    "[[Bruce Schneier]] links here to an interesting report",
    "assume a malicious PR can pop your environment variables straight out (in addition to secrets)",
    "**bold** and *italic* and ~strike~ and <angle> and {braces} and a|pipe",
  ];
  for (const md of samples) {
    const text = markdownToLinkedIn(md);
    assert.equal(fromLittleText(commentaryFor(text)), text, md);
  }
});

test("markdown: wikilinks show as their text, and a link whose text is its URL shows once", () => {
  assert.equal(markdownToLinkedIn("[[Bruce Schneier]] links"), "Bruce Schneier links");
  assert.equal(markdownToLinkedIn("[[Bruce Schneier|Schneier]] says"), "Schneier says");
  assert.equal(markdownToLinkedIn("see [[Note#Part]]"), "see Note > Part");
  assert.equal(markdownToLinkedIn("x ![[image.png]] y"), "x  y");
  assert.equal(
    markdownToLinkedIn("Source: [https://a.example/x](https://a.example/x)"),
    "Source: https://a.example/x"
  );
  assert.equal(
    markdownToLinkedIn("read [the report](https://a.example/r)"),
    "read the report (https://a.example/r)"
  );
});
