// GET /api/hq/city-ranks — latest rank per city × engine + delta vs the prior
// sweep, for the Posts-tab card. Written by /api/cron/city-rank-track.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateWdAdmin } from "@/lib/wd-auth";
import { secretEquals } from "@/lib/secret-compare";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function authorized(request: NextRequest): Promise<boolean> {
  const secret = request.headers.get("x-sync-secret");
  if (secret && secretEquals(secret, process.env.SYNC_SECRET)) return true;
  const { authed } = await validateWdAdmin();
  return authed;
}

export async function GET(request: NextRequest) {
  if (!(await authorized(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    // Two sweeps' worth: 33 cities × 2 engines × 2 = 132 rows, small table.
    const rows = await prisma.cityRankStat.findMany({
      orderBy: { checkedAt: "desc" },
      take: 264,
    });
    const latest = new Map<string, (typeof rows)[number]>();
    const prior = new Map<string, (typeof rows)[number]>();
    for (const r of rows) {
      const key = `${r.city}|${r.st}|${r.engine}`;
      if (!latest.has(key)) latest.set(key, r);
      else if (!prior.has(key)) prior.set(key, r);
    }
    const out = Array.from(latest.entries()).map(([key, r]) => {
      const p = prior.get(key);
      return {
        city: r.city,
        st: r.st,
        engine: r.engine,
        position: r.position,
        foundUrl: r.foundUrl,
        checkedAt: r.checkedAt.toISOString(),
        prevPosition: p ? p.position : undefined,
      };
    });
    return NextResponse.json({
      ranks: out,
      lastSweep: rows.length ? rows[0].checkedAt.toISOString() : null,
    });
  } catch (err) {
    console.error("[hq/city-ranks GET]", err);
    return NextResponse.json({ error: "Failed to load city ranks" }, { status: 500 });
  }
}
