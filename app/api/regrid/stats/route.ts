/**
 * GET /api/regrid/stats
 * Returns cached parcel statistics.
 */

import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET(req: NextRequest) {
  const syncSecret = req.headers.get("x-sync-secret");
  if (!syncSecret || syncSecret !== process.env.SYNC_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const [totalParcels, absenteeCount, vacantCount, offMarketCount, coverageRaw] =
      await Promise.all([
        prisma.parcel.count(),
        prisma.parcel.count({ where: { isAbsentee: true } }),
        prisma.parcel.count({ where: { isVacant: true } }),
        prisma.parcel.count({ where: { listingId: null } }),
        prisma.parcel.groupBy({
          by: ["zip"],
          _count: { id: true },
          orderBy: { _count: { id: "desc" } },
        }),
      ]);

    const coverageByZip = coverageRaw
      .filter((r) => r.zip)
      .map((r) => ({ zip: r.zip!, count: r._count.id }));

    return NextResponse.json({
      totalParcels,
      absenteeCount,
      vacantCount,
      offMarketCount,
      linkedToMLS: totalParcels - offMarketCount,
      coverageByZip,
    });
  } catch (err) {
    console.error("[Regrid Stats]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Stats query failed" },
      { status: 500 }
    );
  }
}
