import { NextRequest, NextResponse } from "next/server";
import { requireAdminApiSession } from "@/lib/admin-auth";
import { backAtYouHealth } from "@/lib/social/backatyou";
import { tiktokServiceHealth } from "@/lib/social/tiktok";
import { pinterestServiceHealth } from "@/lib/social/pinterest";
import { FB_PAGES, getPageToken } from "@/lib/facebook";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface TestResult {
  ok: boolean;
  detail?: string;
  account?: string;
}

async function testFacebook(): Promise<TestResult> {
  const apiVersion = process.env.FACEBOOK_API_VERSION || "v18.0";
  const ok: string[] = [];
  for (const page of FB_PAGES) {
    const token = getPageToken(page);
    if (!token) continue;
    try {
      const res = await fetch(
        `https://graph.facebook.com/${apiVersion}/${page.id}?fields=name&access_token=${token}`,
        { signal: AbortSignal.timeout(8000) },
      );
      if (res.ok) ok.push(page.name);
    } catch {
      /* ignore */
    }
  }
  if (ok.length === 0) return { ok: false, detail: "No FB page tokens working" };
  return { ok: true, detail: `${ok.length} page${ok.length === 1 ? "" : "s"} working`, account: ok.join(", ") };
}

async function testInstagram(): Promise<TestResult> {
  const igUserId = process.env.INSTAGRAM_BUSINESS_ID;
  const token =
    process.env.INSTAGRAM_PAGE_TOKEN ||
    process.env.FACEBOOK_PAGE_TOKEN_RE ||
    process.env.FACEBOOK_PAGE_TOKEN_TREASURE;
  if (!igUserId || !token) return { ok: false, detail: "Missing INSTAGRAM_BUSINESS_ID or page token" };
  const apiVersion = process.env.FACEBOOK_API_VERSION || "v18.0";
  const res = await fetch(
    `https://graph.facebook.com/${apiVersion}/${igUserId}?fields=username,followers_count,media_count&access_token=${token}`,
    { signal: AbortSignal.timeout(8000) },
  );
  if (!res.ok) return { ok: false, detail: `Graph ${res.status}: ${(await res.text()).slice(0, 100)}` };
  const json = (await res.json()) as { username?: string; followers_count?: number; media_count?: number };
  return {
    ok: true,
    account: json.username ? `@${json.username}` : igUserId,
    detail: `${json.followers_count ?? "?"} followers · ${json.media_count ?? "?"} posts`,
  };
}

async function testYouTube(): Promise<TestResult> {
  const clientId = process.env.YOUTUBE_CLIENT_ID;
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
  const refreshToken = process.env.YOUTUBE_REFRESH_TOKEN;
  if (!clientId || !clientSecret || !refreshToken) {
    return { ok: false, detail: "Missing YOUTUBE_CLIENT_ID / SECRET / REFRESH_TOKEN" };
  }

  // Refresh access token.
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
    signal: AbortSignal.timeout(8000),
  });
  if (!tokenRes.ok) {
    return { ok: false, detail: `Refresh failed (${tokenRes.status}) — re-auth needed` };
  }
  const { access_token } = (await tokenRes.json()) as { access_token: string };

  // Pull channel info.
  const chanRes = await fetch(
    "https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true",
    { headers: { Authorization: `Bearer ${access_token}` }, signal: AbortSignal.timeout(8000) },
  );
  if (!chanRes.ok) return { ok: false, detail: `Channel fetch ${chanRes.status}` };
  const chan = (await chanRes.json()) as {
    items?: Array<{ snippet?: { title?: string }; statistics?: { subscriberCount?: string; videoCount?: string } }>;
  };
  const item = chan.items?.[0];
  return {
    ok: true,
    account: item?.snippet?.title ?? "YouTube channel",
    detail: `${item?.statistics?.subscriberCount ?? "?"} subs · ${item?.statistics?.videoCount ?? "?"} videos`,
  };
}

async function testTikTok(): Promise<TestResult> {
  const h = await tiktokServiceHealth();
  if (h.ok) {
    return {
      ok: true,
      account: h.logged_in ? "Selenium session warm" : "Service ready (login on first post)",
      detail: "DGX Selenium driver up; bypasses dev-app review",
    };
  }
  return { ok: false, detail: h.error || "TikTok service unreachable" };
}

async function testPinterest(): Promise<TestResult> {
  // Prefer the DGX Selenium service (works today; bypasses the trial-denied
  // dev-app gate).
  const svc = await pinterestServiceHealth();
  if (svc.ok) {
    return {
      ok: true,
      account: svc.logged_in ? "Selenium session warm" : "Service ready (will check login on first post)",
      detail: "DGX Selenium driver — bypasses trial-denied API",
    };
  }
  const token = process.env.PINTEREST_ACCESS_TOKEN;
  const board = process.env.PINTEREST_DEFAULT_BOARD;
  if (!token || !board) {
    return {
      ok: false,
      detail: svc.error || "Pinterest service unreachable",
    };
  }
  const res = await fetch("https://api.pinterest.com/v5/user_account", {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) return { ok: false, detail: `Pinterest ${res.status}` };
  const json = (await res.json()) as { username?: string };
  return { ok: true, account: json.username ? `@${json.username}` : "Pinterest" };
}

async function testBackAtYou(): Promise<TestResult> {
  const h = await backAtYouHealth();
  if (!h.ok) return { ok: false, detail: h.error || "BAY service unreachable" };
  return {
    ok: true,
    account: h.logged_in ? "Session warm" : "Service ready",
    detail: "Selenium driver up; first post triggers login",
  };
}

const TESTERS: Record<string, () => Promise<TestResult>> = {
  facebook: testFacebook,
  instagram: testInstagram,
  youtube: testYouTube,
  tiktok: testTikTok,
  pinterest: testPinterest,
  backatyou: testBackAtYou,
};

export async function POST(_req: NextRequest, { params }: { params: Promise<{ platform: string }> }) {
  const auth = await requireAdminApiSession();
  if (!auth.ok) return auth.response;
  const { platform } = await params;
  const tester = TESTERS[platform];
  if (!tester) return NextResponse.json({ error: "Unknown platform" }, { status: 404 });
  const result = await tester();
  return NextResponse.json(result);
}
