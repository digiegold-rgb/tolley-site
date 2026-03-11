/**
 * POST /api/regrid/owner
 * Search parcels by owner name — portfolio detection.
 */

import { NextRequest, NextResponse } from "next/server";
import { searchByOwner } from "@/lib/regrid";

export async function POST(req: NextRequest) {
  const syncSecret = req.headers.get("x-sync-secret");
  if (!syncSecret || syncSecret !== process.env.SYNC_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { ownerName, state, county } = body as {
    ownerName: string;
    state?: string;
    county?: string;
  };

  if (!ownerName?.trim()) {
    return NextResponse.json({ error: "ownerName required" }, { status: 400 });
  }

  try {
    const parcels = await searchByOwner(ownerName, { state, county });

    const totalValue = parcels.reduce((sum, p) => sum + (p.parval ?? 0), 0);

    return NextResponse.json({
      ownerName,
      portfolioSize: parcels.length,
      totalValue,
      parcels: parcels.map((p) => ({
        regridId: p.regridId,
        address: p.address,
        city: p.city,
        state: p.state,
        zip: p.zip,
        county: p.county,
        parval: p.parval,
        saleprice: p.saleprice,
        saledate: p.saledate,
        yearbuilt: p.yearbuilt,
        isAbsentee: p.isAbsentee,
        isVacant: p.isVacant,
        zoning: p.zoning,
      })),
    });
  } catch (err) {
    console.error("[Regrid Owner]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Owner search failed" },
      { status: 500 }
    );
  }
}
