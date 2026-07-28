/**
 * GET/POST /api/cron/asin-backfill — Daily ASIN matcher
 *
 * Schedule: DAILY 06:00 UTC (vercel.json crons entry).
 *
 * Was weekly. At ~340 new products/month against a 50-per-run cap, a weekly
 * sweep could never keep up, and fresh inventory was routinely posted to the
 * Treasure Haul Page days before the matcher ever looked at it. Posts that
 * actually need a link now also match just-in-time — see lib/shop/asin-match.
 *
 * Resolves up to 4 unmatched products per run via SerpAPI's Amazon Search
 * engine. New /shop inventory typically gets an Amazon deeplink within 7 days
 * of being listed. Stops early if SerpAPI returns out-of-quota — the next
 * run picks up where it left off since we filter on `amazonAsin: null`.
 */

import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import { serpapiKey } from "@/lib/serpapi";
import { matchAsins } from "@/lib/shop/asin-match";

export const maxDuration = 60;

const RUN_LIMIT = 4;

function authorized(req: NextRequest): boolean {
  const auth = req.headers.get("authorization");
  if (auth && auth === `Bearer ${process.env.CRON_SECRET}`) return true;
  const sync = req.headers.get("x-sync-secret");
  if (sync && sync === process.env.SYNC_SECRET) return true;
  return false;
}

async function runBackfill() {
  const products = await prisma.product.findMany({
    where: { amazonAsin: null, status: { not: "archived" } },
    select: { id: true, title: true, amazonAsin: true, searchKeywords: true, imageUrls: true },
    orderBy: { createdAt: "desc" },
    take: RUN_LIMIT,
  });
  const summary = await matchAsins(products, "asin-backfill");
  return { candidates: products.length, ...summary };
}

export async function GET(req: NextRequest) {
  return handler(req);
}

export async function POST(req: NextRequest) {
  return handler(req);
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

  // Run the work after the response so the cron HTTP call returns fast.
  // Per project rule: plain fn().catch() pre-return gets killed on Vercel;
  // after() is the supported fire-and-forget primitive.
  after(async () => {
    try {
      const summary = await runBackfill();
      console.log("[asin-backfill] done", summary);
    } catch (err) {
      console.error("[asin-backfill] failed", err);
    }
  });

  return NextResponse.json({ scheduled: true, limit: RUN_LIMIT });
}
