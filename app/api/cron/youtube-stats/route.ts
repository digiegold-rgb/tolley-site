import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getYouTubeAccessToken,
  listChannelUploads,
  queryWatchMetrics,
  type VideoWatchMetrics,
} from "@/lib/youtube-analytics";

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
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const auth = await getYouTubeAccessToken();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: 503 });
  }

  try {
    const uploads = await listChannelUploads(auth.token);

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

    const today = new Date();
    const day = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));

    let snapshots = 0;
    for (const u of uploads) {
      const w = watch.get(u.videoId);
      await prisma.youTubeVideo.upsert({
        where: { videoId: u.videoId },
        create: {
          videoId: u.videoId,
          title: u.title,
          publishedAt: new Date(u.publishedAt),
          durationSec: u.durationSec,
        },
        update: {
          title: u.title,
          publishedAt: new Date(u.publishedAt),
          durationSec: u.durationSec,
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
      snapshots++;
    }

    return NextResponse.json({
      ok: true,
      videos: uploads.length,
      snapshots,
      day: day.toISOString().slice(0, 10),
      ...(analyticsError ? { analyticsError } : {}),
    });
  } catch (err) {
    console.error("[cron/youtube-stats] failed", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "pull failed" },
      { status: 500 },
    );
  }
}
