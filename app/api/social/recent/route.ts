import { NextResponse } from "next/server";
import { requireAdminApiSession } from "@/lib/admin-auth";
import { FB_PAGES, getPageToken, getRecentPosts } from "@/lib/facebook";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface RecentPost {
  id: string;
  platform: "facebook" | "instagram" | "youtube" | "tiktok" | "pinterest";
  account: string;
  url: string;
  message: string | null;
  createdTime: string;
  likes: number;
  comments: number;
  shares: number;
  reach: number;
  impressions: number;
  clicks: number;
  engagementRate: number;
}

let cache: { ts: number; posts: RecentPost[] } | null = null;
const TTL_MS = 5 * 60 * 1000;

async function fetchFacebookPosts(perPage: number): Promise<RecentPost[]> {
  const out: RecentPost[] = [];
  for (const page of FB_PAGES) {
    const token = getPageToken(page);
    if (!token) continue;
    const posts = await getRecentPosts(page.id, token, perPage);
    for (const post of posts) {
      out.push({
        id: post.id,
        platform: "facebook",
        account: page.name,
        url: `https://www.facebook.com/${post.id}`,
        message: post.message ?? null,
        createdTime: post.createdTime,
        likes: post.likes,
        comments: post.comments,
        shares: post.shares,
        reach: post.reach,
        impressions: post.impressions,
        clicks: post.clicks,
        engagementRate: post.engagementRate,
      });
    }
  }
  return out;
}

interface IgMediaItem {
  id: string;
  media_type?: string;
  media_url?: string;
  permalink?: string;
  caption?: string;
  timestamp?: string;
  like_count?: number;
  comments_count?: number;
}

async function fetchInstagramPosts(perPage: number): Promise<RecentPost[]> {
  const igUserId = process.env.INSTAGRAM_BUSINESS_ID;
  const token =
    process.env.INSTAGRAM_PAGE_TOKEN ||
    process.env.FACEBOOK_PAGE_TOKEN_TREASURE ||
    process.env.FACEBOOK_PAGE_TOKEN_MAIN;
  if (!igUserId || !token) return [];

  const apiVersion = process.env.FACEBOOK_API_VERSION || "v18.0";
  const url = new URL(`https://graph.facebook.com/${apiVersion}/${igUserId}/media`);
  url.searchParams.set(
    "fields",
    "id,media_type,permalink,caption,timestamp,like_count,comments_count",
  );
  url.searchParams.set("limit", String(perPage));
  url.searchParams.set("access_token", token);

  const res = await fetch(url.toString(), { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) return [];
  const data = (await res.json()) as { data?: IgMediaItem[] };
  return (data.data ?? []).map((m) => ({
    id: m.id,
    platform: "instagram" as const,
    account: "@jaredtolley",
    url: m.permalink ?? `https://www.instagram.com/p/${m.id}/`,
    message: m.caption ?? null,
    createdTime: m.timestamp ?? "",
    likes: m.like_count ?? 0,
    comments: m.comments_count ?? 0,
    shares: 0,
    reach: 0,
    impressions: 0,
    clicks: 0,
    engagementRate: 0,
  }));
}

export async function GET() {
  const auth = await requireAdminApiSession();
  if (!auth.ok) return auth.response;

  const now = Date.now();
  if (cache && now - cache.ts < TTL_MS) {
    return NextResponse.json({ posts: cache.posts, cachedAt: new Date(cache.ts).toISOString() });
  }

  const [fb, ig] = await Promise.all([
    fetchFacebookPosts(10).catch((err) => {
      console.error("[social/recent] FB error:", err);
      return [] as RecentPost[];
    }),
    fetchInstagramPosts(10).catch((err) => {
      console.error("[social/recent] IG error:", err);
      return [] as RecentPost[];
    }),
  ]);

  const posts = [...fb, ...ig].sort(
    (a, b) => new Date(b.createdTime).getTime() - new Date(a.createdTime).getTime(),
  );

  cache = { ts: now, posts };
  return NextResponse.json({ posts, cachedAt: new Date(now).toISOString() });
}
