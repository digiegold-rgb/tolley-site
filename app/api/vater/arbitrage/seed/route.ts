/**
 * POST /api/vater/arbitrage/seed — Seed 5 mock arbitrage pairs (dev convenience)
 */

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getMockPairs, computeMargin } from "@/lib/vater/arbitrage-scanner";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "LOGIN_REQUIRED" }, { status: 401 });
  }

  const mockPairs = getMockPairs();
  const created = [];

  for (const mp of mockPairs) {
    const { ebayFees, profit, marginPercent, roi } = computeMargin(
      mp.ebay.price,
      mp.amazon.price
    );

    const pair = await prisma.arbitragePair.create({
      data: {
        ebayTitle: mp.ebay.title,
        ebayPrice: mp.ebay.price,
        ebayUrl: mp.ebay.url,
        ebayImageUrl: mp.ebay.imageUrl,
        ebayItemId: mp.ebay.itemId,
        amazonTitle: mp.amazon.title,
        amazonPrice: mp.amazon.price,
        amazonUrl: mp.amazon.url,
        amazonImageUrl: mp.amazon.imageUrl,
        amazonAsin: mp.amazon.asin,
        ebayFeeRate: 0.13,
        ebayFees,
        profit,
        marginPercent,
        roi,
        source: "scanner",
        submittedBy: "seed",
        category: mp.category,
      },
    });
    created.push(pair);
  }

  return NextResponse.json({ ok: true, count: created.length, pairs: created }, { status: 201 });
}
