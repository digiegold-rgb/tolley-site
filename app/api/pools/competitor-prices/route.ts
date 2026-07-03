import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { validateShopAdmin } from "@/lib/shop-auth";
import { runPricingEngine } from "@/lib/pools-pricing";

interface CompetitorPriceInput {
  sku: string;
  competitor: string;
  price: number;
  url?: string;
  productName?: string;
  matchType: string;
  matchScore?: number;
}

// POST — bulk upsert competitor prices from scraper
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const expected = `Bearer ${process.env.SYNC_SECRET}`;

  if (!authHeader || authHeader !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const prices: CompetitorPriceInput[] = body.prices;
    const runPricing = body.runPricing !== false; // default true

    if (!Array.isArray(prices) || prices.length === 0) {
      return NextResponse.json({ error: "prices array required" }, { status: 400 });
    }

    let created = 0;
    let errors: string[] = [];

    for (const p of prices) {
      try {
        if (!p.sku || !p.competitor || !p.price || p.price <= 0) {
          errors.push(`Invalid entry: ${p.sku}/${p.competitor}`);
          continue;
        }

        await prisma.competitorPrice.create({
          data: {
            sku: p.sku,
            competitor: p.competitor,
            price: p.price,
            url: p.url || null,
            productName: p.productName || null,
            matchType: p.matchType,
            matchScore: p.matchScore ?? null,
          },
        });
        created++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown";
        errors.push(`${p.sku}/${p.competitor}: ${msg}`);
      }
    }

    // Optionally run pricing engine after ingesting new data
    let pricingResult = null;
    if (runPricing && created > 0) {
      try {
        pricingResult = await runPricingEngine();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown";
        errors.push(`Pricing engine: ${msg}`);
      }
    }

    return NextResponse.json({ created, errors, pricingResult });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: "Bad request", detail: message }, { status: 400 });
  }
}

// GET — return latest competitor prices per product (admin dashboard)
export async function GET(request: NextRequest) {
  const isAdmin = await validateShopAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sku = request.nextUrl.searchParams.get("sku");
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  if (sku) {
    // Single product's competitor prices
    const prices = await prisma.competitorPrice.findMany({
      where: { sku, scannedAt: { gte: sevenDaysAgo } },
      orderBy: { scannedAt: "desc" },
    });
    return NextResponse.json(prices);
  }

  // Latest price per SKU+competitor (for dashboard grid)
  // Only show matches with matchScore >= 0.2 or UPC matches to filter out garbage
  const latestPrices = await prisma.$queryRaw<
    { sku: string; competitor: string; price: number; scannedAt: Date; matchType: string; url: string | null }[]
  >(Prisma.sql`
    SELECT DISTINCT ON (sku, competitor)
      sku, competitor, price, "scannedAt", "matchType", url
    FROM "CompetitorPrice"
    WHERE "scannedAt" >= ${sevenDaysAgo}
      AND ("matchScore" IS NULL OR "matchScore" >= 0.2 OR "matchType" = 'upc')
    ORDER BY sku, competitor, "scannedAt" DESC
  `);

  // Group by SKU
  const bySku: Record<string, Record<string, { price: number; scannedAt: Date; matchType: string; url: string | null }>> = {};
  for (const row of latestPrices) {
    if (!bySku[row.sku]) bySku[row.sku] = {};
    bySku[row.sku][row.competitor] = {
      price: row.price,
      scannedAt: row.scannedAt,
      matchType: row.matchType,
      url: row.url,
    };
  }

  // Get recent price change logs
  const recentChanges = await prisma.priceChangeLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json({ competitorPrices: bySku, recentChanges });
}
