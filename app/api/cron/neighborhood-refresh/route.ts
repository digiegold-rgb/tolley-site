/**
 * GET/POST /api/cron/neighborhood-refresh — weekly content refresh.
 *
 * Schedule: Mondays 11:00 UTC.
 *
 * Refreshes the 5 oldest neighborhood pages so PAA + KG content doesn't go
 * stale. ~5 SerpAPI queries/wk = ~20/mo. Operator can also force-regen via
 * the admin page.
 */

import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import { serpapiKey } from "@/lib/serpapi";
import { generateOne } from "@/lib/neighborhoods/generator";

export const maxDuration = 120;

const REFRESH_LIMIT = 5;

function authorized(req: NextRequest): boolean {
  const auth = req.headers.get("authorization");
  if (auth && auth === `Bearer ${process.env.CRON_SECRET}`) return true;
  const sync = req.headers.get("x-sync-secret");
  if (sync && sync === process.env.SYNC_SECRET) return true;
  return false;
}

async function handler(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!serpapiKey()) {
    return NextResponse.json({ skipped: true }, { status: 200 });
  }

  after(async () => {
    const stale = await prisma.neighborhoodPage.findMany({
      where: { generatedAt: { not: null } },
      orderBy: { generatedAt: "asc" },
      take: REFRESH_LIMIT,
      select: { slug: true },
    });
    let ok = 0;
    let errors = 0;
    for (const s of stale) {
      const r = await generateOne(s.slug, { force: true });
      if (r.ok) ok += 1;
      else errors += 1;
    }
    console.log("[neighborhood-refresh] done", {
      refreshed: ok,
      errors,
      total: stale.length,
    });
  });

  return NextResponse.json({ scheduled: true, limit: REFRESH_LIMIT });
}

export async function GET(req: NextRequest) {
  return handler(req);
}

export async function POST(req: NextRequest) {
  return handler(req);
}
