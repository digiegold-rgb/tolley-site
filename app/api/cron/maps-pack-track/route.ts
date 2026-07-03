/**
 * GET/POST /api/cron/maps-pack-track — Weekly Maps Pack rank snapshot
 *
 * Schedule: Wednesdays 07:00 UTC (vercel.json crons entry).
 *
 * For each TRACKED_KEYWORD × ZIP_GRID combination, query SerpAPI google_maps
 * and record the position of each TRACKED_BUSINESS in the local results.
 * Captures ~32 queries/run = ~140/month at the default config.
 */

import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import { serpapiCall, serpapiKey } from "@/lib/serpapi";
import {
  TRACKED_KEYWORDS,
  ZIP_GRID,
  matchTrackedBusiness,
} from "@/lib/serpapi/maps-config";

export const maxDuration = 120;

function authorized(req: NextRequest): boolean {
  const auth = req.headers.get("authorization");
  if (auth && auth === `Bearer ${process.env.CRON_SECRET}`) return true;
  const sync = req.headers.get("x-sync-secret");
  if (sync && sync === process.env.SYNC_SECRET) return true;
  return false;
}

interface MapsResult {
  position?: number;
  title?: string;
  place_id?: string;
  rating?: number;
  reviews?: number;
  address?: string;
}

async function trackOne(
  keyword: string,
  businesses: string[],
  zip: string,
  lat: number,
  lng: number
): Promise<number> {
  const result = await serpapiCall<{
    local_results?: MapsResult[];
    place_results?: MapsResult;
  }>({
    engine: "google_maps",
    integration: "maps-pack-track",
    params: {
      q: keyword,
      ll: `@${lat},${lng},14z`,
      type: "search",
    },
    timeoutMs: 15000,
  });

  if (!result.ok || !result.data) return 0;

  const localResults = Array.isArray(result.data.local_results)
    ? result.data.local_results
    : [];
  const totalResults = localResults.length;

  // Persist top 5 GBP competitors for this (keyword, zip) once per run so
  // operators can see who outranks them at a glance.
  const top5 = localResults.slice(0, 5).map((r) => ({
    position: typeof r.position === "number" ? r.position : null,
    title: typeof r.title === "string" ? r.title : null,
    placeId: typeof r.place_id === "string" ? r.place_id : null,
    rating: typeof r.rating === "number" ? r.rating : null,
    reviews: typeof r.reviews === "number" ? r.reviews : null,
    address: typeof r.address === "string" ? r.address : null,
  }));
  await prisma.mapsPackSnapshot.create({
    data: {
      keyword,
      zip,
      lat,
      lng,
      topResults: top5,
      totalResults,
    },
  });

  let recorded = 0;
  for (const business of businesses) {
    const hit = localResults.find(
      (r) =>
        typeof r.title === "string" &&
        matchTrackedBusiness(r.title, [business])
    );

    await prisma.mapsPackRank.create({
      data: {
        keyword,
        zip,
        lat,
        lng,
        businessName: business,
        position: typeof hit?.position === "number" ? hit.position : null,
        totalResults,
        placeId: hit?.place_id ?? null,
        rating: typeof hit?.rating === "number" ? hit.rating : null,
        reviews: typeof hit?.reviews === "number" ? hit.reviews : null,
        rawTitle: hit?.title ?? null,
        rawAddress: hit?.address ?? null,
      },
    });
    recorded += 1;
  }
  return recorded;
}

async function runTracker() {
  let queries = 0;
  let recorded = 0;
  for (const kw of TRACKED_KEYWORDS) {
    for (const point of ZIP_GRID) {
      queries += 1;
      try {
        recorded += await trackOne(
          kw.keyword,
          kw.businesses,
          point.zip,
          point.lat,
          point.lng
        );
      } catch (err) {
        console.error("[maps-pack-track] failed", kw.keyword, point.zip, err);
      }
    }
  }
  return { queries, recorded };
}

async function handler(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!serpapiKey()) {
    return NextResponse.json(
      { skipped: true, reason: "SERPAPI_KEY missing" },
      { status: 200 }
    );
  }

  after(async () => {
    try {
      const summary = await runTracker();
      console.log("[maps-pack-track] done", summary);
    } catch (err) {
      console.error("[maps-pack-track] failed", err);
    }
  });

  return NextResponse.json({
    scheduled: true,
    keywords: TRACKED_KEYWORDS.length,
    zips: ZIP_GRID.length,
    expectedQueries: TRACKED_KEYWORDS.length * ZIP_GRID.length,
  });
}

export async function GET(req: NextRequest) {
  return handler(req);
}

export async function POST(req: NextRequest) {
  return handler(req);
}
