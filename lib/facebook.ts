/**
 * Facebook Graph API helper — token management, page insights, posting.
 *
 * Used by:
 * - /api/analytics/facebook (insights pipeline)
 * - lib/content/platforms/facebook.ts (content publishing)
 * - /api/cron/fb-sync (scheduled insight pulls)
 *
 * Env: FACEBOOK_PAGE_TOKEN_WD, FACEBOOK_PAGE_ID_WD, FACEBOOK_API_VERSION
 */

const FB_API = "https://graph.facebook.com";
const API_VERSION = process.env.FACEBOOK_API_VERSION || "v18.0";

// ── Page Config ─────────────────────────────────────────────

export interface FbPageConfig {
  id: string;
  name: string;
  tokenEnvKey: string;
}

export const FB_PAGES: FbPageConfig[] = [
  { id: process.env.FACEBOOK_PAGE_ID_WD || "1060351927154451", name: "Wash & Dry Rental KC", tokenEnvKey: "FACEBOOK_PAGE_TOKEN_WD" },
  { id: process.env.FACEBOOK_PAGE_ID_MAIN || "775948235607331", name: "Wash&Dry Rental", tokenEnvKey: "FACEBOOK_PAGE_TOKEN_MAIN" },
  { id: process.env.FACEBOOK_PAGE_ID_RE || "230414410149647", name: "Your KC Homes", tokenEnvKey: "FACEBOOK_PAGE_TOKEN_RE" },
];

export function getPageToken(page: FbPageConfig): string | null {
  return process.env[page.tokenEnvKey] || null;
}

export function getConfiguredPages(): (FbPageConfig & { token: string })[] {
  return FB_PAGES
    .map((p) => ({ ...p, token: getPageToken(p) || "" }))
    .filter((p) => p.token.length > 0);
}

// ── Graph API Fetch ─────────────────────────────────────────

async function fbGet<T = Record<string, unknown>>(
  path: string,
  token: string,
  params?: Record<string, string>
): Promise<T> {
  const url = new URL(`${FB_API}/${API_VERSION}/${path}`);
  url.searchParams.set("access_token", token);
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  }
  const res = await fetch(url.toString());
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`FB API ${path} failed (${res.status}): ${err.slice(0, 300)}`);
  }
  return res.json() as Promise<T>;
}

async function fbPost<T = Record<string, unknown>>(
  path: string,
  token: string,
  body: Record<string, unknown>
): Promise<T> {
  const url = `${FB_API}/${API_VERSION}/${path}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...body, access_token: token }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`FB API POST ${path} failed (${res.status}): ${err.slice(0, 300)}`);
  }
  return res.json() as Promise<T>;
}

// ── Token Validation ────────────────────────────────────────

export interface TokenDebugInfo {
  isValid: boolean;
  appId?: string;
  type?: string;
  expiresAt?: number;
  scopes?: string[];
  error?: string;
}

export async function validateToken(token: string): Promise<TokenDebugInfo> {
  try {
    const data = await fbGet<{ id?: string; name?: string; error?: { message: string } }>(
      "me",
      token
    );
    if (data.error) return { isValid: false, error: data.error.message };
    return { isValid: true, type: "user_or_page" };
  } catch (e) {
    return { isValid: false, error: e instanceof Error ? e.message : "Unknown error" };
  }
}

// ── Page Insights ───────────────────────────────────────────

export interface PageInsights {
  pageId: string;
  pageName: string;
  period: string;
  reach: number;
  impressions: number;
  engagedUsers: number;
  pageViews: number;
  newFans: number;
  postEngagements: number;
  reactions: number;
  fanCount: number;
  demographics?: {
    ageGender: Record<string, number>;
    cities: Record<string, number>;
    countries: Record<string, number>;
  };
}

interface InsightValue {
  name: string;
  period: string;
  values: { value: number | Record<string, number>; end_time: string }[];
}

interface InsightResponse {
  data: InsightValue[];
}

export async function getPageInsights(
  pageId: string,
  token: string,
  period: "day" | "week" | "days_28" = "days_28"
): Promise<Partial<PageInsights>> {
  const metrics = [
    "page_impressions",
    "page_impressions_unique",
    "page_engaged_users",
    "page_views_total",
    "page_fan_adds",
    "page_post_engagements",
    "page_actions_post_reactions_total",
  ].join(",");

  try {
    const data = await fbGet<InsightResponse>(`${pageId}/insights`, token, {
      metric: metrics,
      period,
    });

    const result: Partial<PageInsights> = { pageId };

    for (const metric of data.data || []) {
      const val = metric.values?.[metric.values.length - 1]?.value;
      const numVal = typeof val === "number" ? val : 0;

      switch (metric.name) {
        case "page_impressions":
          result.impressions = numVal;
          break;
        case "page_impressions_unique":
          result.reach = numVal;
          break;
        case "page_engaged_users":
          result.engagedUsers = numVal;
          break;
        case "page_views_total":
          result.pageViews = numVal;
          break;
        case "page_fan_adds":
          result.newFans = numVal;
          break;
        case "page_post_engagements":
          result.postEngagements = numVal;
          break;
        case "page_actions_post_reactions_total":
          result.reactions = numVal;
          break;
      }
    }

    // Fan count (separate endpoint)
    try {
      const pageData = await fbGet<{ fan_count?: number }>(`${pageId}`, token, {
        fields: "fan_count",
      });
      result.fanCount = pageData.fan_count || 0;
    } catch {
      // fan_count may not be available
    }

    return result;
  } catch (e) {
    console.error(`Failed to fetch insights for ${pageId}:`, e);
    return { pageId };
  }
}

// ── Page Demographics ───────────────────────────────────────

export async function getPageDemographics(
  pageId: string,
  token: string
): Promise<PageInsights["demographics"]> {
  const metrics = [
    "page_fans_city",
    "page_fans_country",
    "page_fans_gender_age",
  ].join(",");

  try {
    const data = await fbGet<InsightResponse>(`${pageId}/insights`, token, {
      metric: metrics,
      period: "lifetime",
    });

    const demographics: PageInsights["demographics"] = {
      ageGender: {},
      cities: {},
      countries: {},
    };

    for (const metric of data.data || []) {
      const val = metric.values?.[metric.values.length - 1]?.value;
      if (typeof val !== "object" || val === null) continue;

      switch (metric.name) {
        case "page_fans_gender_age":
          demographics.ageGender = val as Record<string, number>;
          break;
        case "page_fans_city":
          demographics.cities = val as Record<string, number>;
          break;
        case "page_fans_country":
          demographics.countries = val as Record<string, number>;
          break;
      }
    }

    return demographics;
  } catch {
    return undefined;
  }
}

// ── Post Insights ───────────────────────────────────────────

export interface PostInsight {
  id: string;
  message?: string;
  createdTime: string;
  likes: number;
  comments: number;
  shares: number;
  reach: number;
  impressions: number;
  clicks: number;
  engagementRate: number;
}

interface FbPost {
  id: string;
  message?: string;
  created_time: string;
}

interface FbPostInsightValue {
  name: string;
  values: { value: number }[];
}

export async function getRecentPosts(
  pageId: string,
  token: string,
  limit = 10
): Promise<PostInsight[]> {
  try {
    const posts = await fbGet<{ data: FbPost[] }>(`${pageId}/posts`, token, {
      fields: "id,message,created_time",
      limit: String(limit),
    });

    const results: PostInsight[] = [];

    for (const post of posts.data || []) {
      try {
        const insights = await fbGet<{ data: FbPostInsightValue[] }>(
          `${post.id}/insights`,
          token,
          {
            metric: "post_impressions,post_impressions_unique,post_clicks,post_engaged_users",
          }
        );

        let impressions = 0, reach = 0, clicks = 0, engaged = 0;
        for (const m of insights.data || []) {
          const v = m.values?.[0]?.value || 0;
          if (m.name === "post_impressions") impressions = v;
          if (m.name === "post_impressions_unique") reach = v;
          if (m.name === "post_clicks") clicks = v;
          if (m.name === "post_engaged_users") engaged = v;
        }

        // Reactions/comments/shares from object endpoint
        const reactions = await fbGet<{ summary?: { total_count: number } }>(
          `${post.id}/reactions`,
          token,
          { summary: "true" }
        );
        const comments = await fbGet<{ summary?: { total_count: number } }>(
          `${post.id}/comments`,
          token,
          { summary: "true" }
        );
        const shares = await fbGet<{ shares?: { count: number } }>(
          `${post.id}`,
          token,
          { fields: "shares" }
        );

        const likes = reactions.summary?.total_count || 0;
        const commentCount = comments.summary?.total_count || 0;
        const shareCount = shares.shares?.count || 0;

        results.push({
          id: post.id,
          message: post.message,
          createdTime: post.created_time,
          likes,
          comments: commentCount,
          shares: shareCount,
          reach,
          impressions,
          clicks,
          engagementRate: reach > 0 ? Math.round(((likes + commentCount + shareCount + clicks) / reach) * 10000) / 100 : 0,
        });
      } catch {
        // Skip posts with no insights (e.g., shared links)
        results.push({
          id: post.id,
          message: post.message,
          createdTime: post.created_time,
          likes: 0, comments: 0, shares: 0, reach: 0, impressions: 0, clicks: 0, engagementRate: 0,
        });
      }
    }

    return results;
  } catch (e) {
    console.error(`Failed to fetch posts for ${pageId}:`, e);
    return [];
  }
}

// ── Publishing ──────────────────────────────────────────────

export interface FbPublishResult {
  id: string;
  postUrl: string;
}

export async function publishToPage(
  pageId: string,
  token: string,
  content: {
    message: string;
    link?: string;
    imageUrl?: string;
  }
): Promise<FbPublishResult> {
  let result: { id: string };

  if (content.imageUrl) {
    // Photo post
    result = await fbPost<{ id: string }>(`${pageId}/photos`, token, {
      caption: content.message,
      url: content.imageUrl,
    });
  } else if (content.link) {
    // Link post
    result = await fbPost<{ id: string }>(`${pageId}/feed`, token, {
      message: content.message,
      link: content.link,
    });
  } else {
    // Text post
    result = await fbPost<{ id: string }>(`${pageId}/feed`, token, {
      message: content.message,
    });
  }

  return {
    id: result.id,
    postUrl: `https://www.facebook.com/${result.id}`,
  };
}

// ── Delete Post ─────────────────────────────────────────────

export async function deletePost(postId: string, token: string): Promise<void> {
  const url = `${FB_API}/${API_VERSION}/${postId}`;
  const res = await fetch(url, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ access_token: token }),
  });
  if (!res.ok && res.status !== 404) {
    throw new Error(`FB delete post ${postId} failed: ${res.status}`);
  }
}

// ── Conversation / Messages (Page Inbox) ────────────────────

export interface FbMessage {
  id: string;
  from: { name: string; id: string };
  message: string;
  createdTime: string;
}

export async function getPageConversations(
  pageId: string,
  token: string,
  limit = 10
): Promise<{ id: string; updatedTime: string; messages: FbMessage[] }[]> {
  try {
    const convos = await fbGet<{
      data: { id: string; updated_time: string }[];
    }>(`${pageId}/conversations`, token, {
      fields: "id,updated_time",
      limit: String(limit),
    });

    const results = [];
    for (const convo of convos.data || []) {
      const msgs = await fbGet<{
        data: { id: string; from: { name: string; id: string }; message: string; created_time: string }[];
      }>(`${convo.id}/messages`, token, {
        fields: "id,from,message,created_time",
        limit: "5",
      });

      results.push({
        id: convo.id,
        updatedTime: convo.updated_time,
        messages: (msgs.data || []).map((m) => ({
          id: m.id,
          from: m.from,
          message: m.message,
          createdTime: m.created_time,
        })),
      });
    }

    return results;
  } catch (e) {
    console.error(`Failed to fetch conversations for ${pageId}:`, e);
    return [];
  }
}

// ── Send Reply ──────────────────────────────────────────────

export async function sendPageReply(
  pageId: string,
  token: string,
  recipientId: string,
  message: string
): Promise<{ messageId: string }> {
  const result = await fbPost<{ message_id: string }>(`${pageId}/messages`, token, {
    recipient: { id: recipientId },
    message: { text: message },
    messaging_type: "RESPONSE",
  });
  return { messageId: result.message_id };
}
