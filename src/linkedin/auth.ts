// No Obsidian imports — reusable outside Obsidian.

import * as http from "http";
import * as crypto from "crypto";
import type { LinkedInTokenResponse, LinkedInTokenData } from "./types";
import type { HttpRequestFn } from "./api";

const LINKEDIN_AUTH_URL = "https://www.linkedin.com/oauth/v2/authorization";
const LINKEDIN_TOKEN_URL = "https://www.linkedin.com/oauth/v2/accessToken";
const SCOPES = ["openid", "profile", "w_member_social"];

export interface AuthCallbacks {
  openUrl: (url: string) => void;
  onSuccess: (tokenData: LinkedInTokenData) => void;
  onError: (error: string) => void;
  httpRequest: HttpRequestFn;
  getUserInfo: (
    accessToken: string
  ) => Promise<{ sub: string; name: string }>;
}

export function startOAuthFlow(
  clientId: string,
  clientSecret: string,
  callbacks: AuthCallbacks
): { cancel: () => void } {
  const state = crypto.randomBytes(16).toString("hex");
  let server: http.Server | null = null;

  const cleanup = (): void => {
    if (server) {
      server.close();
      server = null;
    }
  };

  server = http.createServer(async (req, res) => {
    const url = new URL(req.url || "/", "http://127.0.0.1");

    if (url.pathname !== "/callback") {
      res.writeHead(404);
      res.end("Not found");
      return;
    }

    const code = url.searchParams.get("code");
    const returnedState = url.searchParams.get("state");
    const error = url.searchParams.get("error");

    if (error) {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(
        "<html><body><h1>Authorization failed</h1><p>You can close this window.</p></body></html>"
      );
      cleanup();
      callbacks.onError(`LinkedIn authorization failed: ${error}`);
      return;
    }

    if (!code || returnedState !== state) {
      res.writeHead(400, { "Content-Type": "text/html" });
      res.end(
        "<html><body><h1>Invalid request</h1><p>You can close this window.</p></body></html>"
      );
      cleanup();
      callbacks.onError(
        "Invalid OAuth callback: missing code or state mismatch"
      );
      return;
    }

    const port = (server?.address() as { port: number })?.port;
    try {
      const tokenData = await exchangeCodeForTokens(
        code,
        clientId,
        clientSecret,
        `http://127.0.0.1:${port}/callback`,
        callbacks.httpRequest
      );

      const userInfo = await callbacks.getUserInfo(tokenData.accessToken);
      tokenData.personUrn = `urn:li:person:${userInfo.sub}`;

      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(
        `<html><body><h1>Connected to LinkedIn</h1><p>Welcome, ${userInfo.name}! You can close this window.</p></body></html>`
      );
      cleanup();
      callbacks.onSuccess(tokenData);
    } catch (err) {
      res.writeHead(500, { "Content-Type": "text/html" });
      res.end(
        "<html><body><h1>Error</h1><p>Failed to complete authorization. You can close this window.</p></body></html>"
      );
      cleanup();
      callbacks.onError(
        `Token exchange failed: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  });

  server.listen(0, "127.0.0.1", () => {
    const port = (server!.address() as { port: number }).port;
    const redirectUri = `http://127.0.0.1:${port}/callback`;
    const authUrl =
      `${LINKEDIN_AUTH_URL}?response_type=code` +
      `&client_id=${encodeURIComponent(clientId)}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&scope=${encodeURIComponent(SCOPES.join(" "))}` +
      `&state=${encodeURIComponent(state)}`;
    callbacks.openUrl(authUrl);
  });

  return { cancel: cleanup };
}

async function exchangeCodeForTokens(
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string,
  httpRequest: HttpRequestFn
): Promise<LinkedInTokenData> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    client_id: clientId,
    client_secret: clientSecret,
  }).toString();

  const response = await httpRequest({
    url: LINKEDIN_TOKEN_URL,
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (response.status !== 200) {
    throw new Error(
      `Token exchange failed: HTTP ${response.status} — ${response.text}`
    );
  }

  const data: LinkedInTokenResponse = JSON.parse(response.text);
  const now = Date.now();

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: now + data.expires_in * 1000,
    refreshExpiresAt:
      now + (data.refresh_token_expires_in || 31536000) * 1000,
    personUrn: "", // filled in by caller after getUserInfo
  };
}

export async function refreshAccessToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string,
  httpRequest: HttpRequestFn
): Promise<LinkedInTokenData> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
  }).toString();

  const response = await httpRequest({
    url: LINKEDIN_TOKEN_URL,
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (response.status !== 200) {
    throw new Error(
      `Token refresh failed: HTTP ${response.status} — ${response.text}`
    );
  }

  const data: LinkedInTokenResponse = JSON.parse(response.text);
  const now = Date.now();

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: now + data.expires_in * 1000,
    refreshExpiresAt:
      now + (data.refresh_token_expires_in || 31536000) * 1000,
    personUrn: "", // caller must preserve existing personUrn
  };
}

export function isTokenExpiringSoon(
  expiresAt: number,
  thresholdMs: number = 7 * 24 * 60 * 60 * 1000
): boolean {
  return Date.now() + thresholdMs >= expiresAt;
}
