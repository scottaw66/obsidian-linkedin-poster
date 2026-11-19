// The LinkedIn API calls, checked against a fake transport: nothing here reaches LinkedIn.

import { test } from "node:test";
import assert from "node:assert/strict";
import { LinkedInApi, postUrnFromUrl, type HttpRequestFn } from "../src/linkedin/api.ts";

type Sent = Parameters<HttpRequestFn>[0];

function fakeApi(status: number, headers: Record<string, string> = {}) {
  const sent: Sent[] = [];
  const api = new LinkedInApi(async (options) => {
    sent.push(options);
    return { status, headers, text: status >= 400 ? '{"message":"nope"}' : "" };
  });
  return { api, sent };
}

test("postUrnFromUrl reads the URN from a note's linkedin_url", () => {
  assert.equal(
    postUrnFromUrl("https://www.linkedin.com/feed/update/urn:li:share:7529210701391839234"),
    "urn:li:share:7529210701391839234"
  );
  assert.equal(postUrnFromUrl("https://www.linkedin.com/feed/update/urn:li:ugcPost:42/"), "urn:li:ugcPost:42");
  assert.equal(postUrnFromUrl(""), null);
  assert.equal(postUrnFromUrl("https://lnkd.in/p/abc"), null);
});

test("updatePostCommentary sends a PARTIAL_UPDATE that sets only the commentary", async () => {
  const { api, sent } = fakeApi(204);
  const result = await api.updatePostCommentary("token", "urn:li:share:123", "a \\(b\\)");
  assert.deepEqual(result, { success: true, status: 204, postUrn: "urn:li:share:123" });
  assert.equal(sent.length, 1);
  const req = sent[0]!;
  assert.equal(req.method, "POST");
  assert.equal(req.url, "https://api.linkedin.com/rest/posts/urn%3Ali%3Ashare%3A123");
  assert.equal(req.headers["X-RestLi-Method"], "PARTIAL_UPDATE");
  assert.equal(req.headers["X-Restli-Protocol-Version"], "2.0.0");
  assert.equal(req.headers["LinkedIn-Version"], "202611");
  assert.deepEqual(JSON.parse(req.body!), { patch: { $set: { commentary: "a \\(b\\)" } } });
});

test("updatePostCommentary reports LinkedIn's error", async () => {
  const { api } = fakeApi(403);
  const result = await api.updatePostCommentary("token", "urn:li:share:123", "x");
  assert.equal(result.success, false);
  assert.equal(result.status, 403);
  assert.match(result.error ?? "", /HTTP 403/);
});

test("createPost sends the commentary exactly as given and returns the new post's URN", async () => {
  const { api, sent } = fakeApi(201, { "x-restli-id": "urn:li:share:999" });
  const result = await api.createPost("token", "urn:li:person:abc", "hi \\(there\\)", "PUBLIC");
  assert.deepEqual(result, { success: true, status: 201, postUrn: "urn:li:share:999" });
  assert.equal(JSON.parse(sent[0]!.body!).commentary, "hi \\(there\\)");
});
