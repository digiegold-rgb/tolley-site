import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fetchPOIs } from "@/lib/poi";

export const runtime = "nodejs";
export const maxDuration = 300;

const POI_TYPES = [
  "school",
  "hospital",
  "fire_station",
  "police",
  "park",
  "grocery",
  "mall",
  "airport",
  "sports",
  "restaurant",
  "courthouse",
  "library",
];

/**
 * POST /api/poi/sync?type=school
 *
 * Fetches POIs from OpenStreetMap Overpass API and stores in database.
 * Must specify type query param (or "all" to fetch all sequentially).
 */
export async function POST(request: NextRequest) {
  const syncSecret = process.env.SYNC_SECRET;
  const authHeader = request.headers.get("x-sync-secret");
  if (!syncSecret || authHeader !== syncSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const type = request.nextUrl.searchParams.get("type") || "";

  if (!type) {
    return NextResponse.json(
      { error: "type param required (school, hospital, etc. or 'all')" },
      { status: 400 }
    );
  }

  const types = type === "all" ? POI_TYPES : [type];
  const results: Record<string, number> = {};
  const start = Date.now();

  for (const t of types) {
    if (!POI_TYPES.includes(t)) {
      results[t] = -1;
      continue;
    }

    try {
      const pois = await fetchPOIs(t);
      results[t] = pois.length;

      // Batch upsert — delete old + insert new for this type
      await prisma.pointOfInterest.deleteMany({ where: { type: t } });

      // Insert in batches of 500
      for (let i = 0; i < pois.length; i += 500) {
        const batch = pois.slice(i, i + 500);
        await prisma.pointOfInterest.createMany({
          data: batch.map((p) => ({
            osmId: p.osmId,
            type: p.type,
            name: p.name,
            lat: p.lat,
            lng: p.lng,
            tags: p.tags,
          })),
          skipDuplicates: true,
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "unknown";
      console.error(`[poi/sync] ${t} failed:`, msg);
      results[t] = -1;
    }
  }

  return NextResponse.json({
    ok: true,
    types: results,
    durationMs: Date.now() - start,
  });
}
