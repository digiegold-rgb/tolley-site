/**
 * LinkedIn Platform Adapter — Community Management API v2
 *
 * OAuth 2.0 scopes: w_member_social (personal), w_organization_social (company)
 * Publishing: POST /rest/posts
 *
 * Env: LINKEDIN_CLIENT_ID, LINKEDIN_CLIENT_SECRET
 */

import type {
  PlatformAdapter,
  PlatformTokens,
  PublishRequest,
  PublishResult,
  EngagementMetrics,
} from "../types";

const LINKEDIN_AUTH_URL = "https://www.linkedin.com/oauth/v2/authorization";
const LINKEDIN_TOKEN_URL = "https://www.linkedin.com/oauth/v2/accessToken";
const LINKEDIN_API = "https://api.linkedin.com";

export const linkedinAdapter: PlatformAdapter = {
  platform: "linkedin",
  label: "LinkedIn",
  limits: {
    maxTextLength: 3000,
    supportsImages: true,
    supportsVideo: true,
    supportsCarousel: true,
    maxImages: 9,
    maxHashtags: 10,
    rateLimitPerDay: 100,
  },

  getAuthUrl(state: string, redirectUri: string): string {
    const clientId = process.env.LINKEDIN_CLIENT_ID;
    if (!clientId) throw new Error("Missing LINKEDIN_CLIENT_ID");

    const params = new URLSearchParams({
      response_type: "code",
      client_id: clientId,
      redirect_uri: redirectUri,
      state,
      scope: "openid profile w_member_social",
    });

    return `${LINKEDIN_AUTH_URL}?${params.toString()}`;
  },

  async handleCallback(code: string, redirectUri: string): Promise<PlatformTokens> {
    const clientId = process.env.LINKEDIN_CLIENT_ID;
    const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      throw new Error("Missing LINKEDIN_CLIENT_ID or LINKEDIN_CLIENT_SECRET");
    }

    // Exchange code for token
    const tokenRes = await fetch(LINKEDIN_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });

    if (!tokenRes.ok) {
      const err = await tokenRes.text();
      throw new Error(`LinkedIn token exchange failed: ${err}`);
    }

    const tokenData = await tokenRes.json();

    // Get user profile
    const profileRes = await fetch(`${LINKEDIN_API}/v2/userinfo`, {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    let platformAccountId = "unknown";
    let platformUsername: string | undefined;

    if (profileRes.ok) {
      const profile = await profileRes.json();
      platformAccountId = profile.sub || "unknown";
      platformUsername = profile.name || undefined;
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
    const clientId = process.env.LINKEDIN_CLIENT_ID;
    const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      throw new Error("Missing LinkedIn credentials");
    }

    const res = await fetch(LINKEDIN_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });

    if (!res.ok) {
      throw new Error(`LinkedIn token refresh failed: ${res.status}`);
    }

    const data = await res.json();
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || refreshToken,
      expiresAt: data.expires_in
        ? new Date(Date.now() + data.expires_in * 1000)
        : undefined,
      platformAccountId: "", // preserved from connection
    };
  },

  async publishPost(post: PublishRequest, tokens: PlatformTokens): Promise<PublishResult> {
    const author = tokens.pageId
      ? `urn:li:organization:${tokens.pageId}`
      : `urn:li:person:${tokens.platformAccountId}`;

    // Build post body with hashtags appended
    let fullBody = post.body;
    if (post.hashtags?.length) {
      fullBody += "\n\n" + post.hashtags.join(" ");
    }

    // Build the LinkedIn post payload
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const payload: Record<string, any> = {
      author,
      commentary: fullBody,
      visibility: "PUBLIC",
      distribution: {
        feedDistribution: "MAIN_FEED",
        targetEntities: [],
        thirdPartyDistributionChannels: [],
      },
      lifecycleState: "PUBLISHED",
    };

    // Add media if present
    if (post.mediaUrls?.length && post.contentType === "image") {
      // For images, we need to use articles with thumbnails for simplicity
      // Full image upload requires a multi-step process
      payload.content = {
        article: {
          source: post.mediaUrls[0],
          title: post.body.slice(0, 200),
        },
      };
    }

    const res = await fetch(`${LINKEDIN_API}/rest/posts`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokens.accessToken}`,
        "Content-Type": "application/json",
        "X-Restli-Protocol-Version": "2.0.0",
        "LinkedIn-Version": "202401",
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`LinkedIn publish failed (${res.status}): ${errBody.slice(0, 300)}`);
    }

    // LinkedIn returns the post URN in the x-restli-id header
    const postUrn = res.headers.get("x-restli-id") || "";
    const postId = postUrn.replace("urn:li:share:", "").replace("urn:li:ugcPost:", "");

    return {
      platformPostId: postUrn || postId,
      platformUrl: `https://www.linkedin.com/feed/update/${postUrn}`,
    };
  },

  async deletePost(platformPostId: string, tokens: PlatformTokens): Promise<void> {
    const res = await fetch(`${LINKEDIN_API}/rest/posts/${encodeURIComponent(platformPostId)}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${tokens.accessToken}`,
        "X-Restli-Protocol-Version": "2.0.0",
        "LinkedIn-Version": "202401",
      },
    });

    if (!res.ok && res.status !== 404) {
      throw new Error(`LinkedIn delete failed: ${res.status}`);
    }
  },

  async getPostEngagement(platformPostId: string, tokens: PlatformTokens): Promise<EngagementMetrics> {
    // LinkedIn Social Actions API
    const encoded = encodeURIComponent(platformPostId);
    const res = await fetch(
      `${LINKEDIN_API}/v2/socialActions/${encoded}`,
      {
        headers: {
          Authorization: `Bearer ${tokens.accessToken}`,
          "X-Restli-Protocol-Version": "2.0.0",
        },
      }
    );

    if (!res.ok) {
      return { likes: 0, comments: 0, shares: 0, impressions: 0, clicks: 0 };
    }

    const data = await res.json();
    return {
      likes: data.likesSummary?.totalLikes || 0,
      comments: data.commentsSummary?.totalFirstLevelComments || 0,
      shares: data.sharesSummary?.totalShares || 0,
      impressions: 0, // requires separate analytics API
      clicks: 0,
    };
  },
};
