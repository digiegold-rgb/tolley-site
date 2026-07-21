import { getStoredToken } from "./social/token-store";

/**
 * YouTube Data + Analytics API readers for the /hq Stats tab.
 *
 * Auth mirrors lib/social/youtube.ts: DB-stored refresh token (saved by the
 * /api/social/oauth/youtube re-auth) wins, YOUTUBE_REFRESH_TOKEN env is the
 * legacy fallback. Requires the token to carry yt-analytics.readonly — added
 * to the OAuth start route 2026-07-21; older tokens 403 on queryAnalytics
 * until Jared re-consents.
 */

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const DATA_API = "https://www.googleapis.com/youtube/v3";
const ANALYTICS_API = "https://youtubeanalytics.googleapis.com/v2/reports";

export interface UploadedVideo {
  videoId: string;
  title: string;
  publishedAt: string; // ISO
  durationSec: number | null;
  views: number;
  likes: number;
  comments: number;
}

export interface VideoWatchMetrics {
  views: number;
  estimatedMinutesWatched: number;
  avgViewDurationSec: number;
  avgViewPct: number;
  subsGained: number;
}

export async function getYouTubeAccessToken(): Promise<
  { ok: true; token: string } | { ok: false; error: string }
> {
  const clientId = process.env.YOUTUBE_CLIENT_ID?.trim();
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET?.trim();
  const stored = await getStoredToken("youtube");
  const refreshToken = stored?.refreshToken || process.env.YOUTUBE_REFRESH_TOKEN?.trim();

  if (!clientId || !clientSecret || !refreshToken) {
    return { ok: false, error: "YouTube not connected — run the /api/social/oauth/youtube/start re-auth" };
  }

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    return { ok: false, error: `YT token refresh ${res.status}: ${text.slice(0, 200)}` };
  }
  const json = (await res.json()) as { access_token: string };
  return { ok: true, token: json.access_token };
}

/** "PT1M28S" → 88. Returns null on anything unparsable. */
export function parseIsoDuration(iso: string | undefined): number | null {
  if (!iso) return null;
  const m = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso);
  if (!m) return null;
  return (Number(m[1] || 0) * 3600) + (Number(m[2] || 0) * 60) + Number(m[3] || 0);
}

async function dataApi(token: string, path: string, params: Record<string, string>) {
  const url = `${DATA_API}/${path}?${new URLSearchParams(params).toString()}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) {
    throw new Error(`YouTube Data API ${path} ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  return res.json();
}

/**
 * Every upload on the authed channel, with lifetime public counters.
 * channels(mine) → uploads playlist → playlistItems (paged) → videos.list.
 */
export async function listChannelUploads(token: string): Promise<UploadedVideo[]> {
  const ch = await dataApi(token, "channels", { part: "contentDetails", mine: "true" });
  const uploadsPlaylist: string | undefined =
    ch.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
  if (!uploadsPlaylist) throw new Error("No uploads playlist on the authed channel");

  const ids: string[] = [];
  let pageToken = "";
  do {
    const page = await dataApi(token, "playlistItems", {
      part: "contentDetails",
      playlistId: uploadsPlaylist,
      maxResults: "50",
      ...(pageToken ? { pageToken } : {}),
    });
    for (const item of page.items ?? []) {
      const id = item.contentDetails?.videoId;
      if (id) ids.push(id);
    }
    pageToken = page.nextPageToken || "";
  } while (pageToken && ids.length < 2000); // safety cap

  const out: UploadedVideo[] = [];
  for (let i = 0; i < ids.length; i += 50) {
    const batch = await dataApi(token, "videos", {
      part: "snippet,contentDetails,statistics",
      id: ids.slice(i, i + 50).join(","),
      maxResults: "50",
    });
    for (const v of batch.items ?? []) {
      out.push({
        videoId: v.id,
        title: v.snippet?.title || "Untitled",
        publishedAt: v.snippet?.publishedAt || new Date().toISOString(),
        durationSec: parseIsoDuration(v.contentDetails?.duration),
        views: Number(v.statistics?.viewCount || 0),
        likes: Number(v.statistics?.likeCount || 0),
        comments: Number(v.statistics?.commentCount || 0),
      });
    }
  }
  return out;
}

/**
 * Lifetime watch metrics per video from the Analytics API (dimensions=video).
 * Returns a map keyed by videoId; videos with no analytics rows are absent.
 * Requires yt-analytics.readonly on the token.
 */
export async function queryWatchMetrics(
  token: string,
  videoIds: string[],
  startDate = "2020-01-01",
): Promise<Map<string, VideoWatchMetrics>> {
  const out = new Map<string, VideoWatchMetrics>();
  const endDate = new Date().toISOString().slice(0, 10);

  // filters=video==a,b,c is capped at 500 ids; stay well under with 50.
  for (let i = 0; i < videoIds.length; i += 50) {
    const chunk = videoIds.slice(i, i + 50);
    const params = new URLSearchParams({
      ids: "channel==MINE",
      startDate,
      endDate,
      metrics:
        "views,estimatedMinutesWatched,averageViewDuration,averageViewPercentage,subscribersGained",
      dimensions: "video",
      filters: `video==${chunk.join(",")}`,
      maxResults: "200",
    });
    const res = await fetch(`${ANALYTICS_API}?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) {
      throw new Error(
        `YouTube Analytics API ${res.status}: ${(await res.text()).slice(0, 300)}`,
      );
    }
    const json = (await res.json()) as { rows?: (string | number)[][] };
    for (const row of json.rows ?? []) {
      const [id, views, mins, avgDur, avgPct, subs] = row;
      out.set(String(id), {
        views: Number(views || 0),
        estimatedMinutesWatched: Number(mins || 0),
        avgViewDurationSec: Number(avgDur || 0),
        avgViewPct: Number(avgPct || 0),
        subsGained: Number(subs || 0),
      });
    }
  }
  return out;
}
