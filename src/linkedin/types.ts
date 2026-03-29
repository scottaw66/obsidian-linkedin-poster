// No Obsidian imports — this module is reusable outside Obsidian.

export interface LinkedInTokenData {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  refreshExpiresAt: number;
  personUrn: string;
}

export interface LinkedInPostRequest {
  author: string;
  commentary: string;
  visibility: "PUBLIC" | "CONNECTIONS";
  distribution: {
    feedDistribution: "MAIN_FEED";
    targetEntities: never[];
    thirdPartyDistributionChannels: never[];
  };
  content?: {
    article: {
      source: string;
    };
  };
  lifecycleState: "PUBLISHED";
  isReshareDisabledByAuthor: false;
}

export interface LinkedInUserInfo {
  sub: string;
  name: string;
  email?: string;
}

export interface LinkedInTokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token: string;
  refresh_token_expires_in: number;
  scope: string;
  token_type: string;
}

export interface LinkedInPostResult {
  success: boolean;
  postUrn?: string;
  error?: string;
}
