/**
 * GET/POST /api/cron/asin-backfill — Weekly ASIN matcher
 *
 * Schedule: Sundays 06:00 UTC (vercel.json crons entry).
 *
 * Resolves up to 50 unmatched products per run via SerpAPI's Amazon Search
 * engine. New /shop inventory typically gets an Amazon deeplink within 7 days
 * of being listed. Stops early if SerpAPI returns out-of-quota — the next
 * run picks up where it left off since we filter on `amazonAsin: null`.
 */

import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import { serpapiCall, serpapiKey } from "@/lib/serpapi";
import { matchAsinByImage } from "@/lib/amazon/lens-match";

export const maxDuration = 60;

const RUN_LIMIT = 50;

function authorized(req: NextRequest): boolean {
  const auth = req.headers.get("authorization");
  if (auth && auth === `Bearer ${process.env.CRON_SECRET}`) return true;
  const sync = req.headers.get("x-sync-secret");
  if (sync && sync === process.env.SYNC_SECRET) return true;
  return false;
}

interface AmazonOrganic {
  asin?: unknown;
  title?: unknown;
  relevance_score?: unknown;
}

async function findAsin(query: string) {
  const result = await serpapiCall<{ organic_results?: AmazonOrganic[] }>({
    engine: "amazon",
    integration: "asin-backfill",
    params: { amazon_domain: "amazon.com", k: query },
    timeoutMs: 20000,
  });

  if (!result.ok || !result.data) {
    return { hit: null, outOfQuota: result.outOfQuota };
  }

  const organic = Array.isArray(result.data.organic_results)
    ? result.data.organic_results
    : [];
  for (const item of organic) {
    if (typeof item.asin !== "string") continue;
    if (!/^[A-Z0-9]{10}$/.test(item.asin)) continue;
    return {
      hit: {
        asin: item.asin,
        title: typeof item.title === "string" ? item.title : null,
        score:
          typeof item.relevance_score === "number" ? item.relevance_score : null,
      },
      outOfQuota: false,
    };
  }
  return { hit: null, outOfQuota: false };
}

async function runBackfill() {
  const products = await prisma.product.findMany({
    where: { amazonAsin: null, status: { not: "archived" } },
    select: { id: true, title: true, searchKeywords: true, imageUrls: true },
    orderBy: { createdAt: "desc" },
    take: RUN_LIMIT,
  });

  let matched = 0;
  let matchedByLens = 0;
  let missed = 0;
  let errored = 0;
  let stoppedEarly = false;

  for (const p of products) {
    const query = (p.searchKeywords ?? "").trim() || (p.title ?? "").trim();

    let asin: string | null = null;
    let score: number | null = null;

    if (query) {
      const { hit, outOfQuota } = await findAsin(query);
      if (outOfQuota) {
        stoppedEarly = true;
        break;
      }
      if (hit) {
        asin = hit.asin;
        score = hit.score;
      }
    }

    // Lens fallback: thrift/bin-store titles often have no clean Amazon text
    // match, but a product PHOTO does. When the text search misses (or there
    // was no query at all) and the product has a public image, run the
    // previously-idle google_lens reverse-image matcher. This both rescues
    // otherwise-unmatchable inventory into monetized affiliate deeplinks and
    // puts the paid google_lens engine to work.
    if (!asin) {
      const imageUrl = Array.isArray(p.imageUrls) ? p.imageUrls[0] : undefined;
      if (imageUrl && /^https?:\/\//.test(imageUrl)) {
        try {
          const lens = await matchAsinByImage(imageUrl, "asin-backfill-lens");
          if (lens?.asin) {
            asin = lens.asin;
            score = null; // lens has no relevance score
          }
        } catch {
          // best-effort; counted as a miss below
        }
      }
    }

    if (!asin) {
      missed += 1;
      continue;
    }

    try {
      await prisma.product.update({
        where: { id: p.id },
        data: {
          amazonAsin: asin,
          asinMatchScore: score,
          asinMatchedAt: new Date(),
        },
      });
      matched += 1;
      if (score === null) matchedByLens += 1;
    } catch {
      errored += 1;
    }
  }

  return {
    candidates: products.length,
    matched,
    matchedByLens,
    missed,
    errored,
    stoppedEarly,
  };
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
