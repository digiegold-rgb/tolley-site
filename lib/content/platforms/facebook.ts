/**
 * Facebook Platform Adapter — Graph API v18.0
 *
 * Posts to Facebook Pages via page access tokens.
 * Supports text, image, and link posts.
 *
 * Env: FACEBOOK_PAGE_TOKEN_WD (or per-connection tokens from PlatformConnection)
 */

import type {
  PlatformAdapter,
  PlatformTokens,
  PublishRequest,
  PublishResult,
  EngagementMetrics,
} from "../types";
import {
  publishToPage,
  deletePost,
  getConfiguredPages,
} from "@/lib/facebook";

const FB_API = "https://graph.facebook.com";
const API_VERSION = process.env.FACEBOOK_API_VERSION || "v18.0";

export const facebookAdapter: PlatformAdapter = {
  platform: "facebook",
  label: "Facebook",
  limits: {
    maxTextLength: 63206,
    supportsImages: true,
    supportsVideo: true,
    supportsCarousel: true,
    maxImages: 10,
    maxHashtags: 30,
    rateLimitPerDay: 50,
  },

  getAuthUrl(state: string, redirectUri: string): string {
    const appId = process.env.FACEBOOK_APP_ID;
    if (!appId) throw new Error("Missing FACEBOOK_APP_ID");

    const params = new URLSearchParams({
      client_id: appId,
      redirect_uri: redirectUri,
      state,
      scope: "pages_show_list,pages_read_engagement,pages_manage_posts,pages_messaging,pages_read_user_content",
      response_type: "code",
    });

    return `https://www.facebook.com/${API_VERSION}/dialog/oauth?${params.toString()}`;
  },

  async handleCallback(code: string, redirectUri: string): Promise<PlatformTokens> {
    const appId = process.env.FACEBOOK_APP_ID;
    const appSecret = process.env.FACEBOOK_APP_SECRET;
    if (!appId || !appSecret) {
      throw new Error("Missing FACEBOOK_APP_ID or FACEBOOK_APP_SECRET");
    }

    // Exchange code for short-lived user token
    const tokenUrl = new URL(`${FB_API}/${API_VERSION}/oauth/access_token`);
    tokenUrl.searchParams.set("client_id", appId);
    tokenUrl.searchParams.set("client_secret", appSecret);
    tokenUrl.searchParams.set("redirect_uri", redirectUri);
    tokenUrl.searchParams.set("code", code);

    const tokenRes = await fetch(tokenUrl.toString());
    if (!tokenRes.ok) {
      const err = await tokenRes.text();
      throw new Error(`FB token exchange failed: ${err}`);
    }
    const tokenData = await tokenRes.json();
    const shortToken = tokenData.access_token;

    // Exchange for long-lived token (60 days)
    const longUrl = new URL(`${FB_API}/${API_VERSION}/oauth/access_token`);
    longUrl.searchParams.set("grant_type", "fb_exchange_token");
    longUrl.searchParams.set("client_id", appId);
    longUrl.searchParams.set("client_secret", appSecret);
    longUrl.searchParams.set("fb_exchange_token", shortToken);

    const longRes = await fetch(longUrl.toString());
    const longData = longRes.ok ? await longRes.json() : tokenData;
    const accessToken = longData.access_token || shortToken;

    // Get user profile
    const meRes = await fetch(`${FB_API}/${API_VERSION}/me?fields=id,name&access_token=${accessToken}`);
    const me = meRes.ok ? await meRes.json() : { id: "unknown", name: "" };

    // Get page tokens
    const pagesRes = await fetch(
      `${FB_API}/${API_VERSION}/me/accounts?fields=id,name,access_token&access_token=${accessToken}`
    );
    const pages = pagesRes.ok ? await pagesRes.json() : { data: [] };
    const firstPage = pages.data?.[0];

    return {
      accessToken: firstPage?.access_token || accessToken,
      refreshToken: accessToken, // User token serves as refresh path
      expiresAt: longData.expires_in
        ? new Date(Date.now() + longData.expires_in * 1000)
        : new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // 60 days default
      scopes: tokenData.scope?.split(",") || [],
      platformAccountId: me.id,
      platformUsername: me.name,
      pageId: firstPage?.id,
      pageName: firstPage?.name,
    };
  },

  async refreshToken(refreshToken: string): Promise<PlatformTokens> {
    const appId = process.env.FACEBOOK_APP_ID;
    const appSecret = process.env.FACEBOOK_APP_SECRET;
    if (!appId || !appSecret) {
      throw new Error("Missing Facebook credentials");
    }

    // Exchange the long-lived token for a new one
    const url = new URL(`${FB_API}/${API_VERSION}/oauth/access_token`);
    url.searchParams.set("grant_type", "fb_exchange_token");
    url.searchParams.set("client_id", appId);
    url.searchParams.set("client_secret", appSecret);
    url.searchParams.set("fb_exchange_token", refreshToken);

    const res = await fetch(url.toString());
    if (!res.ok) {
      throw new Error(`FB token refresh failed: ${res.status}`);
    }
    const data = await res.json();

    // Re-fetch page token with new user token
    const pagesRes = await fetch(
      `${FB_API}/${API_VERSION}/me/accounts?fields=id,name,access_token&access_token=${data.access_token}`
    );
    const pages = pagesRes.ok ? await pagesRes.json() : { data: [] };
    const firstPage = pages.data?.[0];

    return {
      accessToken: firstPage?.access_token || data.access_token,
      refreshToken: data.access_token,
      expiresAt: data.expires_in
        ? new Date(Date.now() + data.expires_in * 1000)
        : new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
      platformAccountId: "",
      pageId: firstPage?.id,
      pageName: firstPage?.name,
    };
  },

  async publishPost(post: PublishRequest, tokens: PlatformTokens): Promise<PublishResult> {
    const pageId = tokens.pageId || getConfiguredPages()[0]?.id;
    if (!pageId) throw new Error("No Facebook page configured");

    const token = tokens.accessToken;

    // Build message with hashtags
    let message = post.body;
    if (post.hashtags?.length) {
      message += "\n\n" + post.hashtags.join(" ");
    }

    const result = await publishToPage(pageId, token, {
      message,
      imageUrl: post.mediaUrls?.[0],
    });

    return {
      platformPostId: result.id,
      platformUrl: result.postUrl,
    };
  },

  async deletePost(platformPostId: string, tokens: PlatformTokens): Promise<void> {
    await deletePost(platformPostId, tokens.accessToken);
  },

  async getPostEngagement(platformPostId: string, tokens: PlatformTokens): Promise<EngagementMetrics> {
    const token = tokens.accessToken;
    try {
      // Fetch reactions, comments, shares
      const [reactionsRes, commentsRes, postRes] = await Promise.all([
        fetch(`${FB_API}/${API_VERSION}/${platformPostId}/reactions?summary=true&access_token=${token}`),
        fetch(`${FB_API}/${API_VERSION}/${platformPostId}/comments?summary=true&access_token=${token}`),
        fetch(`${FB_API}/${API_VERSION}/${platformPostId}?fields=shares&access_token=${token}`),
      ]);

      const reactions = reactionsRes.ok ? await reactionsRes.json() : {};
      const comments = commentsRes.ok ? await commentsRes.json() : {};
      const post = postRes.ok ? await postRes.json() : {};

      // Fetch post insights
      const insightsRes = await fetch(
        `${FB_API}/${API_VERSION}/${platformPostId}/insights?metric=post_impressions,post_impressions_unique,post_clicks&access_token=${token}`
      );
      const insights = insightsRes.ok ? await insightsRes.json() : { data: [] };

      let impressions = 0, clicks = 0;
      for (const m of insights.data || []) {
        if (m.name === "post_impressions") impressions = m.values?.[0]?.value || 0;
        if (m.name === "post_clicks") clicks = m.values?.[0]?.value || 0;
      }

      return {
        likes: reactions.summary?.total_count || 0,
        comments: comments.summary?.total_count || 0,
        shares: post.shares?.count || 0,
        impressions,
        clicks,
      };
    } catch {
      return { likes: 0, comments: 0, shares: 0, impressions: 0, clicks: 0 };
    }
  },
};
