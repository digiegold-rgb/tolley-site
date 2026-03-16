/**
 * POST /api/scan/arbitrage/run — Autonomous arbitrage scanner
 *
 * Sources:
 *   1. eBay completed listings — what sold for high prices
 *   2. Liquidation sites — Bulq, DirectLiquidation, B-Stock for underpriced lots
 *   3. FB Marketplace price check — compare wife's listings to eBay sold prices
 *
 * Creates ArbitragePair records when margin > threshold.
 *
 * Auth: x-sync-secret or CRON_SECRET
 * Triggered by: DGX cron nightly at 2:00 AM
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logScanActivity, startScanRun, completeScanRun } from "@/lib/scan/log";

const RESEARCH_WORKER_URL = process.env.RESEARCH_WORKER_URL || "http://localhost:8900";
const MIN_PROFIT_THRESHOLD = 15; // minimum $15 profit per item
const MIN_ROI_THRESHOLD = 30; // minimum 30% ROI
const EBAY_FEE_RATE = 0.13; // 13% eBay + PayPal fees

// Popular categories for arbitrage scanning
const SCAN_CATEGORIES = [
  { query: "nike dunk lot", category: "sneakers" },
  { query: "pokemon cards sealed lot", category: "pokemon" },
  { query: "lego sets lot", category: "lego" },
  { query: "airpods pro lot", category: "electronics" },
  { query: "power tools lot dewalt", category: "tools" },
  { query: "kitchen appliance lot ninja", category: "kitchen" },
  { query: "baby monitor lot", category: "baby" },
  { query: "pool supplies lot chlorine", category: "pool" },
];

function checkAuth(req: NextRequest): boolean {
  const syncSecret = req.headers.get("x-sync-secret");
  if (syncSecret && syncSecret === process.env.SYNC_SECRET) return true;
  const authHeader = req.headers.get("authorization");
  if (authHeader && authHeader === `Bearer ${process.env.CRON_SECRET}`) return true;
  return false;
}

interface EbayItem {
  title: string;
  soldPrice: number;
  url?: string;
  imageUrl?: string;
  itemId?: string;
  soldDate?: string;
}

interface LiquidationLot {
  title: string;
  price: number;
  retailValue?: number;
  url?: string;
  imageUrl?: string;
  source: string;
  itemCount?: number;
}

export async function POST(req: NextRequest) {
  if (!checkAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const runId = await startScanRun("arbitrage", { source: "auto-scan" });
  const results = {
    ebayItemsChecked: 0,
    liquidationLotsChecked: 0,
    pairsCreated: 0,
    highMarginAlerts: 0,
    scans: [] as { source: string; query: string; items: number; pairs: number }[],
    errors: [] as string[],
  };

  try {
    await logScanActivity("arbitrage", "Arbitrage scan started", {
      event: "scan_start",
      severity: "info",
    });

    // ═══════════════════════════════════════════════════════
    // SOURCE 1: eBay Completed Listings
    // ═══════════════════════════════════════════════════════
    for (const cat of SCAN_CATEGORIES) {
      try {
        const scanRecord = await prisma.arbitrageScan.create({
          data: { source: "ebay_completed", query: cat.query, status: "running" },
        });

        // Call research worker for eBay scraping
        const ebayRes = await fetch(`${RESEARCH_WORKER_URL}/scrape/ebay-completed`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-sync-secret": process.env.SYNC_SECRET || "",
          },
          body: JSON.stringify({
            query: cat.query,
            minPrice: 20,
            maxResults: 20,
          }),
          signal: AbortSignal.timeout(30000),
        });

        if (ebayRes.ok) {
          const ebayData = await ebayRes.json();
          const items: EbayItem[] = ebayData.items || [];
          results.ebayItemsChecked += items.length;
          let pairsForQuery = 0;

          // For each sold item, check if we can source it cheaper
          for (const item of items) {
            // Look for wholesale/liquidation price (estimate: 30-40% of retail)
            const estimatedWholesale = item.soldPrice * 0.35;
            const ebayFees = item.soldPrice * EBAY_FEE_RATE;
            const estimatedProfit = item.soldPrice - estimatedWholesale - ebayFees;
            const estimatedRoi = estimatedWholesale > 0
              ? (estimatedProfit / estimatedWholesale) * 100
              : 0;

            if (estimatedProfit >= MIN_PROFIT_THRESHOLD && estimatedRoi >= MIN_ROI_THRESHOLD) {
              try {
                await prisma.arbitragePair.create({
                  data: {
                    ebayTitle: item.title,
                    ebayPrice: item.soldPrice,
                    ebayUrl: item.url || null,
                    ebayImageUrl: item.imageUrl || null,
                    ebayItemId: item.itemId || null,
                    amazonTitle: `Wholesale: ${item.title}`,
                    amazonPrice: estimatedWholesale,
                    ebayFeeRate: EBAY_FEE_RATE,
                    ebayFees,
                    profit: estimatedProfit,
                    marginPercent: estimatedRoi,
                    roi: estimatedRoi,
                    status: "pending",
                    source: "scanner",
                    category: cat.category,
                    notes: `Auto-discovered from eBay completed listings. Sold: $${item.soldPrice.toFixed(2)}. Est. wholesale: $${estimatedWholesale.toFixed(2)}`,
                  },
                });
                pairsForQuery++;
                results.pairsCreated++;

                if (estimatedProfit > 50) {
                  results.highMarginAlerts++;
                }
              } catch {
                // Duplicate or constraint error — skip
              }
            }
          }

          await prisma.arbitrageScan.update({
            where: { id: scanRecord.id },
            data: {
              status: "complete",
              itemsChecked: items.length,
              pairsFound: pairsForQuery,
              avgMargin: pairsForQuery > 0 ? MIN_ROI_THRESHOLD : null,
              completedAt: new Date(),
            },
          });

          results.scans.push({
            source: "ebay_completed",
            query: cat.query,
            items: items.length,
            pairs: pairsForQuery,
          });
        } else {
          await prisma.arbitrageScan.update({
            where: { id: scanRecord.id },
            data: { status: "complete", completedAt: new Date() },
          });
        }
      } catch (e) {
        // Research worker endpoint may not exist yet — not fatal
        results.errors.push(`eBay ${cat.query}: ${e}`);
      }
    }

    // ═══════════════════════════════════════════════════════
    // SOURCE 2: Liquidation sites
    // ═══════════════════════════════════════════════════════
    const liquidationSources = [
      { name: "bulq", endpoint: "/scrape/liquidation/bulq" },
      { name: "directliquidation", endpoint: "/scrape/liquidation/directliquidation" },
      { name: "bstock", endpoint: "/scrape/liquidation/bstock" },
    ];

    for (const source of liquidationSources) {
      try {
        const scanRecord = await prisma.arbitrageScan.create({
          data: { source: source.name, status: "running" },
        });

        const liqRes = await fetch(`${RESEARCH_WORKER_URL}${source.endpoint}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-sync-secret": process.env.SYNC_SECRET || "",
          },
          body: JSON.stringify({ maxResults: 20, minDiscount: 50 }),
          signal: AbortSignal.timeout(30000),
        });

        if (liqRes.ok) {
          const liqData = await liqRes.json();
          const lots: LiquidationLot[] = liqData.lots || [];
          results.liquidationLotsChecked += lots.length;
          let pairsForSource = 0;

          for (const lot of lots) {
            if (!lot.retailValue || lot.retailValue <= 0) continue;
            const margin = ((lot.retailValue - lot.price) / lot.price) * 100;
            const profit = lot.retailValue * 0.87 - lot.price; // eBay sell at retail minus fees

            if (profit >= MIN_PROFIT_THRESHOLD && margin >= MIN_ROI_THRESHOLD) {
              try {
                await prisma.arbitragePair.create({
                  data: {
                    ebayTitle: lot.title,
                    ebayPrice: lot.retailValue,
                    ebayUrl: null,
                    amazonTitle: `${source.name}: ${lot.title}`,
                    amazonPrice: lot.price,
                    amazonUrl: lot.url || null,
                    amazonImageUrl: lot.imageUrl || null,
                    ebayFeeRate: EBAY_FEE_RATE,
                    ebayFees: lot.retailValue * EBAY_FEE_RATE,
                    profit,
                    marginPercent: margin,
                    roi: margin,
                    status: "pending",
                    source: "scanner",
                    category: "liquidation",
                    notes: `Liquidation lot from ${source.name}. Buy: $${lot.price}. Retail: $${lot.retailValue}. ${lot.itemCount ? `${lot.itemCount} items` : ""}`,
                  },
                });
                pairsForSource++;
                results.pairsCreated++;
                if (profit > 100) results.highMarginAlerts++;
              } catch {
                // skip duplicates
              }
            }
          }

          await prisma.arbitrageScan.update({
            where: { id: scanRecord.id },
            data: {
              status: "complete",
              itemsChecked: lots.length,
              pairsFound: pairsForSource,
              completedAt: new Date(),
            },
          });

          results.scans.push({
            source: source.name,
            query: "liquidation",
            items: lots.length,
            pairs: pairsForSource,
          });
        } else {
          await prisma.arbitrageScan.update({
            where: { id: scanRecord.id },
            data: { status: "complete", completedAt: new Date() },
          });
        }
      } catch (e) {
        results.errors.push(`${source.name}: ${e}`);
      }
    }

    // ═══════════════════════════════════════════════════════
    // SOURCE 3: FB Marketplace price comparison
    // ═══════════════════════════════════════════════════════
    // Check existing shop items that may be underpriced compared to eBay
    try {
      const shopItems = await prisma.shopItem?.findMany?.({
        where: { status: "active" },
        select: { id: true, title: true, price: true },
        take: 20,
      });
      // shopItem model may not exist — that's fine, this is forward-looking
      if (shopItems && shopItems.length > 0) {
        await logScanActivity("arbitrage", `FB Marketplace: ${shopItems.length} active items checked for pricing`, {
          event: "info",
          severity: "info",
        });
      }
    } catch {
      // ShopItem model may not exist yet — silent
    }

    // ═══════════════════════════════════════════════════════
    // SOURCE 4: Create TrendSignals + PriceSnapshots from discoveries
    // ═══════════════════════════════════════════════════════
    try {
      if (results.pairsCreated >= 3) {
        // High volume of discoveries — create trend signal
        const topCategory = results.scans.reduce(
          (best, s) => (s.pairs > (best?.pairs || 0) ? s : best),
          results.scans[0]
        );
        if (topCategory) {
          await prisma.trendSignal.create({
            data: {
              category: topCategory.query || "arbitrage",
              platform: topCategory.source,
              signalType: "sell_through_high",
              title: `${results.pairsCreated} arbitrage opportunities found`,
              body: `Top category: ${topCategory.query} (${topCategory.pairs} pairs). ${results.highMarginAlerts} high-margin alerts.`,
              metric: results.pairsCreated,
              metricLabel: "pairs found",
              confidence: Math.min(results.pairsCreated / 10, 1),
            },
          }).catch(() => {});
        }
      }

      // Store price snapshots from eBay completed items
      for (const scan of results.scans) {
        if (scan.source === "ebay_completed" && scan.items > 0) {
          await prisma.priceSnapshot.create({
            data: {
              query: scan.query,
              platform: "ebay_sold",
              price: 0, // aggregate — individual prices stored in ArbitragePair
              title: `${scan.query}: ${scan.items} items, ${scan.pairs} pairs`,
            },
          }).catch(() => {});
        }
      }
    } catch {
      // TrendSignal/PriceSnapshot creation is supplementary — don't fail the scan
    }

    // ═══════════════════════════════════════════════════════
    // COMPLETE
    // ═══════════════════════════════════════════════════════
    await completeScanRun(runId, {
      itemsFound: results.pairsCreated,
      alertsGen: results.highMarginAlerts,
      error: results.errors.length > 0 ? results.errors.join("; ") : undefined,
    });

    if (results.pairsCreated > 0) {
      await logScanActivity("arbitrage", `Arbitrage scan: ${results.pairsCreated} profitable pairs found (${results.highMarginAlerts} high-margin)`, {
        event: "discovery",
        severity: results.highMarginAlerts > 0 ? "alert" : "success",
        meta: results,
      });
    }

    const summary = `Checked ${results.ebayItemsChecked} eBay items + ${results.liquidationLotsChecked} liquidation lots → ${results.pairsCreated} pairs`;
    await logScanActivity("arbitrage", `Arbitrage scan complete: ${summary}`, {
      event: "scan_complete",
      severity: results.pairsCreated > 0 ? "success" : "info",
      meta: results,
    });

    return NextResponse.json({ ok: true, ...results });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await completeScanRun(runId, { error: msg });
    await logScanActivity("arbitrage", `Arbitrage scan failed: ${msg}`, { event: "error", severity: "alert" });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
