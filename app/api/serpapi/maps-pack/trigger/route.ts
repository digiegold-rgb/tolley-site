import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import { serpapiCall, serpapiKey } from "@/lib/serpapi";
import {
  TRACKED_KEYWORDS,
  ZIP_GRID,
  matchTrackedBusiness,
} from "@/lib/serpapi/maps-config";
import { validateShopAdmin } from "@/lib/shop-auth";

export const maxDuration = 120;

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
) {
  const result = await serpapiCall<{ local_results?: MapsResult[] }>({
    engine: "google_maps",
    integration: "maps-pack-track",
    params: {
      q: keyword,
      ll: `@${lat},${lng},14z`,
      type: "search",
    },
    timeoutMs: 15000,
  });
  if (!result.ok || !result.data) return;

  const localResults = Array.isArray(result.data.local_results)
    ? result.data.local_results
    : [];

  const top5 = localResults.slice(0, 5).map((r) => ({
    position: typeof r.position === "number" ? r.position : null,
    title: typeof r.title === "string" ? r.title : null,
    placeId: typeof r.place_id === "string" ? r.place_id : null,
    rating: typeof r.rating === "number" ? r.rating : null,
    reviews: typeof r.reviews === "number" ? r.reviews : null,
    address: typeof r.address === "string" ? r.address : null,
  }));
  await prisma.mapsPackSnapshot.create({
    data: { keyword, zip, lat, lng, topResults: top5, totalResults: localResults.length },
  });

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
        totalResults: localResults.length,
        placeId: hit?.place_id ?? null,
        rating: typeof hit?.rating === "number" ? hit.rating : null,
        reviews: typeof hit?.reviews === "number" ? hit.reviews : null,
        rawTitle: hit?.title ?? null,
        rawAddress: hit?.address ?? null,
      },
    });
  }
}

export async function POST(_req: NextRequest) {
  if (!(await validateShopAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!serpapiKey()) {
    return NextResponse.json(
      { error: "SERPAPI_KEY missing" },
      { status: 503 }
    );
  }

  after(async () => {
    for (const kw of TRACKED_KEYWORDS) {
      for (const point of ZIP_GRID) {
        try {
          await trackOne(kw.keyword, kw.businesses, point.zip, point.lat, point.lng);
        } catch (err) {
          console.error("[maps-pack-trigger]", kw.keyword, point.zip, err);
        }
      }
    }
  });

  return NextResponse.json({
    scheduled: true,
    expectedQueries: TRACKED_KEYWORDS.length * ZIP_GRID.length,
  });
}
