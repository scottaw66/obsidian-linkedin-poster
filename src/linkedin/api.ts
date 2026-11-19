// No Obsidian imports — reusable outside Obsidian.

import type {
  LinkedInPostRequest,
  LinkedInPostResult,
  LinkedInUserInfo,
} from "./types";

const LINKEDIN_API_BASE = "https://api.linkedin.com";
// LinkedIn API version (YYYYMM). Each version is retired about a year after release: 202601 sunsets
// 2027-01-15 (LinkedIn's docs, read 2026-11-19), so this moved to 202611, the current one that day.
const LINKEDIN_VERSION = "202611";

export type HttpRequestFn = (options: {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: string;
}) => Promise<{
  status: number;
  headers: Record<string, string>;
  text: string;
}>;

/** The post's URN from its linkedin_url (…/feed/update/urn:li:share:123), or null. */
export function postUrnFromUrl(linkedinUrl: string): string | null {
  const match = linkedinUrl.match(/urn:li:(?:share|ugcPost):\d+/);
  return match ? match[0] : null;
}

export class LinkedInApi {
  // A plain field, not a constructor parameter property: Node runs this file directly in the tests
  // by stripping the types, and it can't strip parameter properties.
  private httpRequest: HttpRequestFn;

  constructor(httpRequest: HttpRequestFn) {
    this.httpRequest = httpRequest;
  }

  async getUserInfo(accessToken: string): Promise<LinkedInUserInfo> {
    const response = await this.httpRequest({
      url: `${LINKEDIN_API_BASE}/v2/userinfo`,
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (response.status !== 200) {
      throw new Error(`Failed to get user info: HTTP ${response.status}`);
    }

    return JSON.parse(response.text);
  }

  /**
   * `commentary` must already be in LinkedIn's little text format (utils/little.ts): this sends it
   * exactly as given.
   */
  async createPost(
    accessToken: string,
    personUrn: string,
    commentary: string,
    visibility: "PUBLIC" | "CONNECTIONS",
    articleUrl?: string
  ): Promise<LinkedInPostResult> {
    const post = {
      author: personUrn,
      commentary,
      visibility,
      distribution: {
        feedDistribution: "MAIN_FEED",
        targetEntities: [],
        thirdPartyDistributionChannels: [],
      },
      lifecycleState: "PUBLISHED",
      isReshareDisabledByAuthor: false,
      ...(articleUrl
        ? { content: { article: { source: articleUrl, title: articleUrl } } }
        : {}),
    };

    const response = await this.httpRequest({
      url: `${LINKEDIN_API_BASE}/rest/posts`,
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "X-Restli-Protocol-Version": "2.0.0",
        "LinkedIn-Version": LINKEDIN_VERSION,
      },
      body: JSON.stringify(post),
    });

    if (response.status === 201) {
      const postUrn =
        response.headers["x-restli-id"] ||
        response.headers["X-RestLi-Id"] ||
        undefined;
      return { success: true, status: response.status, postUrn };
    }

    if (response.status === 429) {
      return {
        success: false,
        status: response.status,
        error: "LinkedIn rate limit reached. Try again later.",
      };
    }

    return {
      success: false,
      status: response.status,
      error: `LinkedIn API error: HTTP ${response.status} — ${response.text}`,
    };
  }

  /**
   * Replace an existing post's text (`commentary`, already in little text format) in place.
   * LinkedIn's Posts API PARTIAL_UPDATE; it answers 204 on success. Added 2026-11-19 to repair posts
   * the unescaped text had cut off. An edit keeps the post's date, likes and comments and shows an
   * "Edited" label on LinkedIn.
   */
  async updatePostCommentary(
    accessToken: string,
    postUrn: string,
    commentary: string
  ): Promise<LinkedInPostResult> {
    const response = await this.httpRequest({
      url: `${LINKEDIN_API_BASE}/rest/posts/${encodeURIComponent(postUrn)}`,
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "X-Restli-Protocol-Version": "2.0.0",
        "X-RestLi-Method": "PARTIAL_UPDATE",
        "LinkedIn-Version": LINKEDIN_VERSION,
      },
      body: JSON.stringify({ patch: { $set: { commentary } } }),
    });

    if (response.status === 204 || response.status === 200) {
      return { success: true, status: response.status, postUrn };
    }

    return {
      success: false,
      status: response.status,
      error: `LinkedIn API error: HTTP ${response.status} — ${response.text}`,
    };
  }
}
