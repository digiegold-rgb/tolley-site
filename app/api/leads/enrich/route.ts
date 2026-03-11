import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { enrichListing } from "@/lib/enrichment";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * POST /api/leads/enrich
 *
 * Enriches all listings with POI proximity data and buy-side scores.
 * Query params:
 *   ?limit=500    — max listings to enrich (default 500)
 *   ?force=true   — re-enrich already enriched listings
 */
export async function POST(request: NextRequest) {
  const syncSecret = process.env.SYNC_SECRET;
  const authHeader = request.headers.get("x-sync-secret");
  if (!syncSecret || authHeader !== syncSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limit = Math.min(Number(request.nextUrl.searchParams.get("limit")) || 500, 5000);
  const force = request.nextUrl.searchParams.get("force") === "true";
  const start = Date.now();

  // Load all POIs into memory grouped by type
  const allPois = await prisma.pointOfInterest.findMany({
    select: { type: true, name: true, lat: true, lng: true },
  });

  if (allPois.length === 0) {
    return NextResponse.json(
      { error: "No POIs in database. Run /api/poi/sync?type=all first." },
      { status: 400 }
    );
  }

  const poisByType = new Map<string, Array<{ type: string; name: string | null; lat: number; lng: number }>>();
  for (const poi of allPois) {
    const arr = poisByType.get(poi.type) || [];
    arr.push(poi);
    poisByType.set(poi.type, arr);
  }

  const poiStats: Record<string, number> = {};
  for (const [type, pois] of poisByType) {
    poiStats[type] = pois.length;
  }

  // Get listings needing enrichment
  const where: Record<string, unknown> = {
    lat: { not: null },
    lng: { not: null },
  };
  if (!force) {
    where.enrichment = null;
  }

  const listings = await prisma.listing.findMany({
    where,
    select: { id: true, lat: true, lng: true, listPrice: true },
    take: limit,
  });

  let enriched = 0;

  for (const listing of listings) {
    if (listing.lat == null || listing.lng == null) continue;

    const result = enrichListing(listing.lat, listing.lng, poisByType, listing.listPrice);

    await prisma.listingEnrichment.upsert({
      where: { listingId: listing.id },
      create: {
        listingId: listing.id,
        ...result,
      },
      update: {
        ...result,
        enrichedAt: new Date(),
      },
    });

    enriched++;
  }

  return NextResponse.json({
    ok: true,
    poisLoaded: poiStats,
    totalPois: allPois.length,
    listingsEnriched: enriched,
    listingsRemaining: (await prisma.listing.count({
      where: { lat: { not: null }, lng: { not: null }, enrichment: null },
    })),
    durationMs: Date.now() - start,
  });
}
