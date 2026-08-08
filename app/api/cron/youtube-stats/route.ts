import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getChannelIdentity,
  getYouTubeAccessToken,
  listChannelUploads,
  queryWatchMetrics,
  type VideoWatchMetrics,
} from "@/lib/youtube-analytics";
import { getStoredTokens } from "@/lib/social/token-store";
import { secretEquals } from "@/lib/secret-compare";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Daily YouTube snapshot for the /hq Stats tab. Lists every upload on the
 * channel (Data API), pulls lifetime watch metrics (Analytics API), and
 * upserts one YouTubeVideoStat row per video per UTC day. Deltas are computed
 * at read time from consecutive snapshots — this route only records.
 *
 * pipeline attribution is NEVER touched here — the DGX owns it via
 * POST /api/hq/stats/videos; upserts only set it on first sight (default
 * "other").
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || !secretEquals(req.headers.get("authorization"), `Bearer ${secret}`)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Snapshot EVERY connected channel, not just the most recently refreshed
  // one. With @yourkchome (legacy/crypto) and @yourkchomes (real estate) both
  // live, reading a single token meant one channel's numbers silently replaced
  // the other's on /hq.
  const connections = await getStoredTokens("youtube");
  const targets = connections.length
    ? connections
    : [{ refreshToken: null, accountId: null, username: null }];

  const today = new Date();
  const day = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));

  let snapshots = 0;
  let videos = 0;
  const perChannel: Array<Record<string, unknown>> = [];
  const errors: string[] = [];

  for (const conn of targets) {
    const auth = await getYouTubeAccessToken(conn.refreshToken);
    if (!auth.ok) {
      errors.push(`${conn.username ?? conn.accountId ?? "default"}: ${auth.error}`);
      continue;
    }

    try {
      const channel = await getChannelIdentity(auth.token);
      const uploads = await listChannelUploads(auth.token);
      videos += uploads.length;

      // Watch metrics need yt-analytics.readonly — an older token 403s here.
      // Degrade to Data-API-only snapshots rather than recording nothing.
      let watch: Map<string, VideoWatchMetrics> = new Map();
      let analyticsError: string | null = null;
      try {
        watch = await queryWatchMetrics(auth.token, uploads.map((u) => u.videoId));
      } catch (err) {
        analyticsError = err instanceof Error ? err.message : String(err);
        console.warn("[cron/youtube-stats] analytics unavailable:", analyticsError);
      }

      let channelSnaps = 0;
      for (const u of uploads) {
        const w = watch.get(u.videoId);
        await prisma.youTubeVideo.upsert({
          where: { videoId: u.videoId },
          create: {
            videoId: u.videoId,
            title: u.title,
            publishedAt: new Date(u.publishedAt),
            durationSec: u.durationSec,
            channelId: channel.id,
            channelTitle: channel.title,
          },
          update: {
            title: u.title,
            publishedAt: new Date(u.publishedAt),
            durationSec: u.durationSec,
            channelId: channel.id,
            channelTitle: channel.title,
          },
        });
        await prisma.youTubeVideoStat.upsert({
          where: { videoId_day: { videoId: u.videoId, day } },
          create: {
            videoId: u.videoId,
            day,
            views: u.views,
            likes: u.likes,
            comments: u.comments,
            estimatedMinutesWatched: w?.estimatedMinutesWatched ?? null,
            avgViewDurationSec: w?.avgViewDurationSec ?? null,
            avgViewPct: w?.avgViewPct ?? null,
            subsGained: w?.subsGained ?? null,
          },
          update: {
            views: u.views,
            likes: u.likes,
            comments: u.comments,
            estimatedMinutesWatched: w?.estimatedMinutesWatched ?? null,
            avgViewDurationSec: w?.avgViewDurationSec ?? null,
            avgViewPct: w?.avgViewPct ?? null,
            subsGained: w?.subsGained ?? null,
            pulledAt: new Date(),
          },
        });
        channelSnaps++;
      }
      snapshots += channelSnaps;
      perChannel.push({
        channelId: channel.id,
        channelTitle: channel.title,
        videos: uploads.length,
        snapshots: channelSnaps,
        ...(analyticsError ? { analyticsError } : {}),
      });
    } catch (err) {
      // One bad channel must not lose the other channel's snapshot.
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[cron/youtube-stats] channel failed", conn.username, msg);
      errors.push(`${conn.username ?? conn.accountId ?? "default"}: ${msg}`);
    }
  }

  if (!perChannel.length) {
    return NextResponse.json({ error: errors.join(" | ") || "no channels" }, { status: 503 });
  }
  return NextResponse.json({
    ok: true,
    channels: perChannel,
    videos,
    snapshots,
    day: day.toISOString().slice(0, 10),
    ...(errors.length ? { errors } : {}),
  });
}
