/**
 * Dynamic pricing engine for pool supply products.
 *
 * Strategy:
 *   - With competitor data (<48h): undercut lowest competitor by 10%, floor at 25% margin
 *   - Without competitor data: flat 45% markup (current behavior)
 *
 * Safety rails:
 *   - Hard floor: never below costPrice * 1.10
 *   - Max single change: 30% (flagged for review if exceeded)
 *   - Stale data (>7d): revert to 45% markup
 *   - Manual retailPrice override = skip dynamic pricing
 */

import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

const MARKUP_DEFAULT = 1.45;
const UNDERCUT_FACTOR = 0.90; // 10% below lowest competitor
const MIN_MARGIN_FACTOR = 1.25; // 25% minimum margin
const HARD_FLOOR_FACTOR = 1.10; // absolute minimum: 10% margin
const MAX_CHANGE_PCT = 0.30; // flag changes > 30%
const FRESH_HOURS = 48;
const STALE_DAYS = 7;

export interface PricingDecision {
  sku: string;
  oldPrice: number;
  newPrice: number;
  retailPrice: number | null;
  costPrice: number;
  reason: string;
  margin: number;
  competitors: Record<string, number>;
  flagged: boolean;
}

export function calcDynamicPrice(
  costPrice: number,
  competitorPrices: { competitor: string; price: number; scannedAt: Date }[],
  currentPrice: number,
): PricingDecision & { newPrice: number; retailPrice: number | null; reason: string } {
  const now = Date.now();
  const freshCutoff = now - FRESH_HOURS * 60 * 60 * 1000;
  const staleCutoff = now - STALE_DAYS * 24 * 60 * 60 * 1000;

  // Filter to non-stale prices and reject prices below cost (bad scraper matches)
  const validPrices = competitorPrices.filter(
    (cp) => cp.scannedAt.getTime() > staleCutoff && cp.price >= costPrice
  );

  // Build competitor snapshot
  const competitors: Record<string, number> = {};
  for (const cp of validPrices) {
    if (!competitors[cp.competitor] || cp.price < competitors[cp.competitor]) {
      competitors[cp.competitor] = cp.price;
    }
  }

  // Check if we have fresh data
  const freshPrices = validPrices.filter(
    (cp) => cp.scannedAt.getTime() > freshCutoff
  );

  if (freshPrices.length === 0) {
    // No fresh competitor data → flat markup
    const fallbackPrice = Math.round(costPrice * MARKUP_DEFAULT);
    const margin = Math.round(((fallbackPrice - costPrice) / fallbackPrice) * 100);
    return {
      sku: "",
      oldPrice: currentPrice,
      newPrice: fallbackPrice,
      retailPrice: null,
      costPrice,
      reason: validPrices.length > 0 ? "stale_data_fallback" : "no_data_fallback",
      margin,
      competitors,
      flagged: false,
    };
  }

  // Find minimum competitor price
  const minRetail = Math.min(...freshPrices.map((cp) => cp.price));

  // Calculate target price: 10% undercut of lowest competitor
  const targetPrice = Math.floor(minRetail * UNDERCUT_FACTOR);

  // Floor: 25% minimum margin
  const floorPrice = Math.ceil(costPrice * MIN_MARGIN_FACTOR);

  // Hard floor: never below 10% margin
  const hardFloor = Math.ceil(costPrice * HARD_FLOOR_FACTOR);

  let newPrice = Math.max(targetPrice, floorPrice, hardFloor);

  // Determine reason
  let reason: string;
  if (newPrice === hardFloor && targetPrice < hardFloor) {
    reason = "margin_floor";
  } else if (newPrice === floorPrice && targetPrice < floorPrice) {
    reason = "margin_floor";
  } else {
    reason = "competitor_undercut";
  }

  // Check max change threshold
  const changePct = Math.abs(newPrice - currentPrice) / currentPrice;
  const flagged = changePct > MAX_CHANGE_PCT;

  const margin = Math.round(((newPrice - costPrice) / newPrice) * 100);

  return {
    sku: "",
    oldPrice: currentPrice,
    newPrice,
    retailPrice: minRetail,
    costPrice,
    reason,
    margin,
    competitors,
    flagged,
  };
}

/**
 * Run pricing engine across all products with competitor data.
 * Updates PoolProduct.price + retailPrice, logs PriceChangeLog entries.
 */
export async function runPricingEngine(): Promise<{
  updated: number;
  flagged: number;
  skipped: number;
}> {
  const freshCutoff = new Date(Date.now() - STALE_DAYS * 24 * 60 * 60 * 1000);

  // Get all products with cost data (skip manually priced products)
  const products = await prisma.poolProduct.findMany({
    where: { status: "active", costPrice: { not: null }, priceOverride: false },
    select: {
      id: true,
      sku: true,
      price: true,
      costPrice: true,
      retailPrice: true,
    },
  });

  // Get all recent competitor prices
  const competitorPrices = await prisma.competitorPrice.findMany({
    where: { scannedAt: { gte: freshCutoff } },
    select: { sku: true, competitor: true, price: true, scannedAt: true },
  });

  // Group competitor prices by SKU
  const pricesBySku = new Map<string, typeof competitorPrices>();
  for (const cp of competitorPrices) {
    const arr = pricesBySku.get(cp.sku) || [];
    arr.push(cp);
    pricesBySku.set(cp.sku, arr);
  }

  let updated = 0;
  let flagged = 0;
  let skipped = 0;

  for (const product of products) {
    if (!product.costPrice) {
      skipped++;
      continue;
    }

    const skuPrices = pricesBySku.get(product.sku);
    if (!skuPrices || skuPrices.length === 0) {
      skipped++;
      continue;
    }

    const decision = calcDynamicPrice(
      product.costPrice,
      skuPrices,
      product.price,
    );

    // Skip if price hasn't changed
    if (decision.newPrice === product.price && decision.retailPrice === product.retailPrice) {
      skipped++;
      continue;
    }

    // If flagged for large change, skip auto-update (admin review needed)
    if (decision.flagged) {
      flagged++;
      // Still log it for admin visibility
      await prisma.priceChangeLog.create({
        data: {
          sku: product.sku,
          oldPrice: product.price,
          newPrice: decision.newPrice,
          costPrice: product.costPrice,
          reason: `FLAGGED_${decision.reason}`,
          competitors: decision.competitors as Prisma.InputJsonValue,
          margin: decision.margin,
        },
      });
      continue;
    }

    // Update product price
    await prisma.poolProduct.update({
      where: { id: product.id },
      data: {
        price: decision.newPrice,
        ...(decision.retailPrice != null ? { retailPrice: decision.retailPrice } : {}),
      },
    });

    // Log the change
    await prisma.priceChangeLog.create({
      data: {
        sku: product.sku,
        oldPrice: product.price,
        newPrice: decision.newPrice,
        costPrice: product.costPrice,
        reason: decision.reason,
        competitors: decision.competitors as Prisma.InputJsonValue,
        margin: decision.margin,
      },
    });

    updated++;
  }

  return { updated, flagged, skipped };
}

/**
 * Calculate dynamic price for a single product during sync.
 * Returns { price, retailPrice } or null if no competitor data.
 */
export async function getDynamicPriceForSku(
  sku: string,
  costPrice: number,
  currentPrice: number
): Promise<{ price: number; retailPrice: number | null } | null> {
  // Check if product has manual price override
  const product = await prisma.poolProduct.findUnique({
    where: { sku },
    select: { priceOverride: true },
  });
  if (product?.priceOverride) return null;

  const freshCutoff = new Date(Date.now() - STALE_DAYS * 24 * 60 * 60 * 1000);

  const competitorPrices = await prisma.competitorPrice.findMany({
    where: { sku, scannedAt: { gte: freshCutoff } },
    select: { competitor: true, price: true, scannedAt: true },
  });

  if (competitorPrices.length === 0) return null;

  const decision = calcDynamicPrice(costPrice, competitorPrices, currentPrice);

  if (decision.reason.includes("no_data") || decision.reason.includes("stale")) {
    return null;
  }

  return { price: decision.newPrice, retailPrice: decision.retailPrice };
}
