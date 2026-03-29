// No Obsidian imports — reusable outside Obsidian.

import type {
  LinkedInPostRequest,
  LinkedInPostResult,
  LinkedInUserInfo,
} from "./types";

const LINKEDIN_API_BASE = "https://api.linkedin.com";
const LINKEDIN_VERSION = "202401";

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

export class LinkedInApi {
  constructor(private httpRequest: HttpRequestFn) {}

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

  async createPost(
    accessToken: string,
    personUrn: string,
    commentary: string,
    visibility: "PUBLIC" | "CONNECTIONS",
    articleUrl?: string
  ): Promise<LinkedInPostResult> {
    const post: LinkedInPostRequest = {
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
    };

    if (articleUrl) {
      post.content = {
        article: {
          source: articleUrl,
        },
      };
    }

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
      return { success: true, postUrn };
    }

    if (response.status === 429) {
      return {
        success: false,
        error: "LinkedIn rate limit reached. Try again later.",
      };
    }

    return {
      success: false,
      error: `LinkedIn API error: HTTP ${response.status} — ${response.text}`,
    };
  }
}
