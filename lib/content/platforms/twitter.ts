/**
 * X/Twitter Platform Adapter — API v2 (Basic tier, $100/mo)
 *
 * OAuth 2.0 PKCE: tweet.write, tweet.read, users.read, dm.write
 * Publishing: POST /2/tweets
 *
 * Env: TWITTER_CLIENT_ID, TWITTER_CLIENT_SECRET
 */

import type {
  PlatformAdapter,
  PlatformTokens,
  PublishRequest,
  PublishResult,
  EngagementMetrics,
} from "../types";

const TWITTER_AUTH_URL = "https://twitter.com/i/oauth2/authorize";
const TWITTER_TOKEN_URL = "https://api.twitter.com/2/oauth2/token";
const TWITTER_API = "https://api.twitter.com";

export const twitterAdapter: PlatformAdapter = {
  platform: "twitter",
  label: "X / Twitter",
  limits: {
    maxTextLength: 280,
    supportsImages: true,
    supportsVideo: true,
    supportsCarousel: false,
    maxImages: 4,
    maxHashtags: 5,
    rateLimitPerDay: 17, // Basic tier: 17 tweets/24hr per user
  },

  getAuthUrl(state: string, redirectUri: string): string {
    const clientId = process.env.TWITTER_CLIENT_ID;
    if (!clientId) throw new Error("Missing TWITTER_CLIENT_ID");

    // Generate PKCE code challenge (S256)
    // In production, generate a proper code_verifier per session
    // For now, use state as the code_verifier (stored server-side)
    const params = new URLSearchParams({
      response_type: "code",
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: "tweet.read tweet.write users.read offline.access",
      state,
      code_challenge: state, // simplified — store and match server-side
      code_challenge_method: "plain",
    });

    return `${TWITTER_AUTH_URL}?${params.toString()}`;
  },

  async handleCallback(code: string, redirectUri: string): Promise<PlatformTokens> {
    const clientId = process.env.TWITTER_CLIENT_ID;
    const clientSecret = process.env.TWITTER_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      throw new Error("Missing TWITTER_CLIENT_ID or TWITTER_CLIENT_SECRET");
    }

    // Exchange code for token
    const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
    const tokenRes = await fetch(TWITTER_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${basicAuth}`,
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        code_verifier: "plain", // match the challenge method
      }),
    });

    if (!tokenRes.ok) {
      const err = await tokenRes.text();
      throw new Error(`Twitter token exchange failed: ${err}`);
    }

    const tokenData = await tokenRes.json();

    // Get user profile
    const profileRes = await fetch(`${TWITTER_API}/2/users/me`, {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    let platformAccountId = "unknown";
    let platformUsername: string | undefined;

    if (profileRes.ok) {
      const profile = await profileRes.json();
      platformAccountId = profile.data?.id || "unknown";
      platformUsername = profile.data?.username || undefined;
    }

    return {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      expiresAt: tokenData.expires_in
        ? new Date(Date.now() + tokenData.expires_in * 1000)
        : undefined,
      scopes: tokenData.scope?.split(" ") || [],
      platformAccountId,
      platformUsername,
    };
  },

  async refreshToken(refreshToken: string): Promise<PlatformTokens> {
    const clientId = process.env.TWITTER_CLIENT_ID;
    const clientSecret = process.env.TWITTER_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      throw new Error("Missing Twitter credentials");
    }

    const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
    const res = await fetch(TWITTER_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${basicAuth}`,
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      }),
    });

    if (!res.ok) {
      throw new Error(`Twitter token refresh failed: ${res.status}`);
    }

    const data = await res.json();
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || refreshToken,
      expiresAt: data.expires_in
        ? new Date(Date.now() + data.expires_in * 1000)
        : undefined,
      platformAccountId: "",
    };
  },

  async publishPost(post: PublishRequest, tokens: PlatformTokens): Promise<PublishResult> {
    // Build tweet text with hashtags
    let text = post.body;
    if (post.hashtags?.length) {
      const hashtagStr = post.hashtags.join(" ");
      // Only append if we have room
      if (text.length + hashtagStr.length + 2 <= 280) {
        text += "\n" + hashtagStr;
      }
    }

    // Enforce 280 char limit
    if (text.length > 280) {
      text = text.slice(0, 277) + "...";
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const payload: Record<string, any> = { text };

    // Note: media upload requires a separate endpoint (POST /2/media/upload)
    // For MVP, we post text-only. Media support added in Phase 2.

    const res = await fetch(`${TWITTER_API}/2/tweets`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokens.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`Twitter publish failed (${res.status}): ${errBody.slice(0, 300)}`);
    }

    const data = await res.json();
    const tweetId = data.data?.id || "";

    return {
      platformPostId: tweetId,
      platformUrl: `https://twitter.com/i/web/status/${tweetId}`,
    };
  },

  async deletePost(platformPostId: string, tokens: PlatformTokens): Promise<void> {
    const res = await fetch(`${TWITTER_API}/2/tweets/${platformPostId}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${tokens.accessToken}`,
      },
    });

    if (!res.ok && res.status !== 404) {
      throw new Error(`Twitter delete failed: ${res.status}`);
    }
  },

  async getPostEngagement(platformPostId: string, tokens: PlatformTokens): Promise<EngagementMetrics> {
    const res = await fetch(
      `${TWITTER_API}/2/tweets/${platformPostId}?tweet.fields=public_metrics`,
      {
        headers: { Authorization: `Bearer ${tokens.accessToken}` },
      }
    );

    if (!res.ok) {
      return { likes: 0, comments: 0, shares: 0, impressions: 0, clicks: 0 };
    }

    const data = await res.json();
    const metrics = data.data?.public_metrics || {};

    return {
      likes: metrics.like_count || 0,
      comments: metrics.reply_count || 0,
      shares: metrics.retweet_count || 0,
      impressions: metrics.impression_count || 0,
      clicks: 0, // not available in basic metrics
    };
  },
};
