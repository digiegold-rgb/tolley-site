import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateShopAdmin } from "@/lib/shop-auth";

const RESEARCH_WORKER_URL = process.env.RESEARCH_WORKER_URL || "http://localhost:8900";

export async function POST(req: NextRequest) {
  const isAdmin = await validateShopAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { query, productId, platform = "ebay_sold" } = body;

  if (!query) {
    return NextResponse.json({ error: "query required" }, { status: 400 });
  }

  try {
    // Call research worker for eBay sold listings
    const res = await fetch(`${RESEARCH_WORKER_URL}/scrape/ebay-completed`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-sync-secret": process.env.SYNC_SECRET || "",
      },
      body: JSON.stringify({ query, maxResults: 20 }),
      signal: AbortSignal.timeout(30000),
    });

    if (!res.ok) {
      return NextResponse.json({ error: "Research worker unavailable" }, { status: 502 });
    }

    const data = await res.json();
    const items = data.items || [];

    // Store as PriceSnapshot records
    const snapshots = [];
    for (const item of items) {
      const snapshot = await prisma.priceSnapshot.create({
        data: {
          productId: productId || null,
          query,
          platform,
          title: item.title,
          price: item.soldPrice || item.price,
          url: item.url || null,
          imageUrl: item.imageUrl || null,
          soldDate: item.soldDate ? new Date(item.soldDate) : null,
          condition: item.condition || null,
        },
      });
      snapshots.push(snapshot);
    }

    // Compute summary stats
    const prices = snapshots.map((s) => s.price).filter((p) => p > 0);
    const avgPrice = prices.length ? Math.round((prices.reduce((a, b) => a + b, 0) / prices.length) * 100) / 100 : 0;
    const sorted = [...prices].sort((a, b) => a - b);
    const medianPrice = sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0;
    const lowPrice = sorted[0] || 0;
    const highPrice = sorted[sorted.length - 1] || 0;

    return NextResponse.json({
      query,
      compsCount: snapshots.length,
      avgPrice,
      medianPrice,
      lowPrice,
      highPrice,
      comps: snapshots,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
