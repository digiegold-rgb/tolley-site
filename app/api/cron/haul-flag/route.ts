import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const maxDuration = 60;

// Products are Amazon-Haul-eligible when they have an ASIN and the lowest
// known price is below this ceiling. Amazon's Haul cutoff is $20 but we
// leave a small buffer for price drift between scrape and click.
const HAUL_PRICE_CEILING = 20;

// Re-check freshness. Once a row is flagged we don't re-evaluate it until
// the timestamp is older than this — keeps the nightly cron cheap.
const HAUL_RECHECK_DAYS = 7;

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = req.headers.get("authorization");
  return header === `Bearer ${secret}`;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const recheckCutoff = new Date(
    Date.now() - HAUL_RECHECK_DAYS * 24 * 60 * 60 * 1000,
  );

  // Candidates: any ASIN-tagged product whose price signal is under the
  // ceiling, OR which has never been Haul-checked, OR whose last check is
  // older than the recheck window.
  const candidates = await prisma.product.findMany({
    where: {
      amazonAsin: { not: null },
      OR: [
        { haulCheckedAt: null },
        { haulCheckedAt: { lt: recheckCutoff } },
      ],
    },
    include: {
      listings: { select: { price: true, status: true } },
    },
    take: 2000,
  });

  let flagged = 0;
  let cleared = 0;
  const now = new Date();

  for (const p of candidates) {
    // Cheapest known price wins — target, sold, or any active listing.
    const prices: number[] = [];
    if (p.targetPrice && p.targetPrice > 0) prices.push(p.targetPrice);
    if (p.soldPrice && p.soldPrice > 0) prices.push(p.soldPrice);
    for (const l of p.listings) {
      if (l.price && l.price > 0 && l.status !== "removed") prices.push(l.price);
    }
    const minPrice = prices.length ? Math.min(...prices) : null;
    const eligible = minPrice !== null && minPrice <= HAUL_PRICE_CEILING;

    if (eligible !== p.haulEligible) {
      await prisma.product.update({
        where: { id: p.id },
        data: { haulEligible: eligible, haulCheckedAt: now },
      });
      if (eligible) flagged++;
      else cleared++;
    } else {
      await prisma.product.update({
        where: { id: p.id },
        data: { haulCheckedAt: now },
      });
    }
  }

  const totalHaul = await prisma.product.count({ where: { haulEligible: true } });

  return NextResponse.json({
    ok: true,
    considered: candidates.length,
    flagged,
    cleared,
    totalHaulEligible: totalHaul,
    priceCeiling: HAUL_PRICE_CEILING,
  });
}
