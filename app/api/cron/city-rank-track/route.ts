/**
 * GET/POST /api/cron/city-rank-track — Monthly city search-rank snapshot
 *
 * Schedule: 9th of the month 09:00 UTC (vercel.json crons entry).
 *
 * For each of the 33 "New KC Homes Today" cities, ask Google organic and
 * YouTube search where our content ranks (tolley.io / @yourkchome). 66 calls
 * per sweep against the "city-rank-track" budget in MONTHLY_CAPS.
 *
 * Smoke test: ?limit=2 caps the sweep at N cities (4 calls).
 */

import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import { serpapiCall, serpapiKey } from "@/lib/serpapi";
import {
  TRACKED_CITIES,
  googleQuery,
  youtubeQuery,
  isOurGoogleResult,
  isOurYoutubeResult,
  type TrackedCity,
} from "@/lib/serpapi/rank-config";

export const maxDuration = 300;

function authorized(req: NextRequest): boolean {
  const auth = req.headers.get("authorization");
  if (auth && auth === `Bearer ${process.env.CRON_SECRET}`) return true;
  const sync = req.headers.get("x-sync-secret");
  if (sync && sync === process.env.SYNC_SECRET) return true;
  return false;
}

interface OrganicResult {
  position?: number;
  link?: string;
  title?: string;
}

interface YoutubeResult {
  position_on_page?: number;
  link?: string;
  title?: string;
  channel?: { name?: string; link?: string };
}

async function trackGoogle(c: TrackedCity): Promise<void> {
  const query = googleQuery(c);
  const result = await serpapiCall<{ organic_results?: OrganicResult[] }>({
    engine: "google",
    integration: "city-rank-track",
    params: { q: query, location: "Kansas City, Missouri, United States", num: "20" },
    timeoutMs: 15000,
  });
  const organic = result.ok && Array.isArray(result.data?.organic_results)
    ? result.data.organic_results
    : [];
  const hit = organic.find((r) =>
    isOurGoogleResult(r.link ?? "", r.title ?? ""),
  );
  await prisma.cityRankStat.create({
    data: {
      city: c.city,
      st: c.st,
      engine: "google",
      query,
      position: typeof hit?.position === "number" ? hit.position : null,
      foundUrl: hit?.link ?? null,
    },
  });
}

async function trackYoutube(c: TrackedCity): Promise<void> {
  const query = youtubeQuery(c);
  const result = await serpapiCall<{ video_results?: YoutubeResult[] }>({
    engine: "youtube",
    integration: "city-rank-track",
    params: { search_query: query },
    timeoutMs: 15000,
  });
  const videos = result.ok && Array.isArray(result.data?.video_results)
    ? result.data.video_results
    : [];
  let position: number | null = null;
  let hit: YoutubeResult | undefined;
  for (let i = 0; i < videos.length; i++) {
    const v = videos[i];
    if (isOurYoutubeResult(v.channel?.name ?? "", v.channel?.link ?? "")) {
      position = typeof v.position_on_page === "number" ? v.position_on_page : i + 1;
      hit = v;
      break;
    }
  }
  const videoId = hit?.link?.match(/(?:youtu\.be\/|v=)([\w-]{6,})/)?.[1] ?? null;
  await prisma.cityRankStat.create({
    data: {
      city: c.city,
      st: c.st,
      engine: "youtube",
      query,
      position,
      foundUrl: hit?.link ?? null,
      videoId,
    },
  });
}

async function runTracker(limit: number) {
  const cities = limit > 0 ? TRACKED_CITIES.slice(0, limit) : TRACKED_CITIES;
  let queries = 0;
  for (const c of cities) {
    for (const fn of [trackGoogle, trackYoutube]) {
      queries += 1;
      try {
        await fn(c);
      } catch (err) {
        console.error("[city-rank-track] failed", c.city, c.st, err);
      }
    }
  }
  return { cities: cities.length, queries };
}

async function handler(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!serpapiKey()) {
    return NextResponse.json(
      { skipped: true, reason: "SERPAPI_KEY missing" },
      { status: 200 },
    );
  }
  const limit = Math.max(0, Number(req.nextUrl.searchParams.get("limit")) || 0);

  after(async () => {
    try {
      const summary = await runTracker(limit);
      console.log("[city-rank-track] done", summary);
    } catch (err) {
      console.error("[city-rank-track] failed", err);
    }
  });

  return NextResponse.json({
    scheduled: true,
    cities: limit > 0 ? limit : TRACKED_CITIES.length,
    expectedQueries: (limit > 0 ? limit : TRACKED_CITIES.length) * 2,
  });
}

export async function GET(req: NextRequest) {
  return handler(req);
}

export async function POST(req: NextRequest) {
  return handler(req);
}
