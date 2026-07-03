import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateShopAdmin } from "@/lib/shop-auth";

export async function GET(_req: NextRequest) {
  if (!(await validateShopAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Latest run = most recent createdAt; group by (keyword, zip, businessName).
  // We pull the last 200 rows and dedupe in memory — at 32 rows/run this is
  // ~6 runs of history, plenty for a glanceable dashboard.
  const recent = await prisma.mapsPackRank.findMany({
    orderBy: { createdAt: "desc" },
    take: 500,
  });

  const latestByKey = new Map<string, (typeof recent)[number]>();
  for (const row of recent) {
    const key = `${row.keyword}::${row.zip}::${row.businessName}`;
    if (!latestByKey.has(key)) latestByKey.set(key, row);
  }

  // Trend per (keyword, businessName) — last 8 runs averaged across zips
  const series = new Map<string, { date: string; avgPosition: number | null }[]>();
  for (const row of recent) {
    const key = `${row.keyword}::${row.businessName}`;
    if (!series.has(key)) series.set(key, []);
  }

  // Latest competitor snapshots, deduped by (keyword, zip)
  const snapshotsRaw = await prisma.mapsPackSnapshot.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  const latestSnapByKey = new Map<string, (typeof snapshotsRaw)[number]>();
  for (const row of snapshotsRaw) {
    const key = `${row.keyword}::${row.zip}`;
    if (!latestSnapByKey.has(key)) latestSnapByKey.set(key, row);
  }

  const result = {
    latest: Array.from(latestByKey.values()).map((r) => ({
      keyword: r.keyword,
      zip: r.zip,
      businessName: r.businessName,
      position: r.position,
      totalResults: r.totalResults,
      rating: r.rating,
      reviews: r.reviews,
      rawTitle: r.rawTitle,
      capturedAt: r.createdAt,
    })),
    competitors: Array.from(latestSnapByKey.values()).map((s) => ({
      keyword: s.keyword,
      zip: s.zip,
      topResults: s.topResults,
      totalResults: s.totalResults,
      capturedAt: s.createdAt,
    })),
    runCount: new Set(recent.map((r) => r.createdAt.toISOString().slice(0, 10))).size,
  };

  return NextResponse.json(result);
}
