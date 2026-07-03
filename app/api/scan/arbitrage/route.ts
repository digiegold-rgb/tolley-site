/**
 * POST /api/scan/arbitrage — Autonomous arbitrage scanner
 *
 * Sources (all Vercel-runtime safe — no DGX research worker required):
 *   1. eBay sold/completed — direct HTML scrape (proven pattern from lib/shop/intelligence.ts)
 *   2. Liquidation sites — best-effort via research worker; skipped + logged when unreachable
 *
 * Creates ArbitragePair records when estimated margin > threshold.
 *
 * Auth: x-sync-secret or CRON_SECRET
 * Triggered by: DGX cron nightly at 2:00 AM (run-scanner.sh arbitrage)
 *
 * History: Pre-2026-04-29 the scanner relied entirely on research-worker endpoints
 * (/scrape/ebay-completed, /scrape/liquidation/*) that were never built — every nightly
 * run silently returned pairsCreated=0 with errors=[] (the !res.ok branch swallowed 404s).
 * This rewrite scrapes eBay directly, same as the shop-intelligence cron.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logScanActivity, startScanRun, completeScanRun } from "@/lib/scan/log";

const RESEARCH_WORKER_URL = process.env.RESEARCH_WORKER_URL || "http://localhost:8900";
const MIN_PROFIT_THRESHOLD = 15; // minimum $15 profit per item
const MIN_ROI_THRESHOLD = 30; // minimum 30% ROI
const EBAY_FEE_RATE = 0.13; // 13% eBay + PayPal fees
const WHOLESALE_DISCOUNT = 0.35; // estimate wholesale at 35% of sold price

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

/**
 * Direct-scrape eBay sold/completed listings. No API key required.
 * Extracts title (img alt) + price ($N.NN) pairs, returns up to maxResults.
 */
async function scrapeEbaySold(query: string, maxResults = 25): Promise<EbayItem[]> {
  try {
    const url = `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(query)}&LH_Complete=1&LH_Sold=1&_ipg=${maxResults}`;
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
      },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return [];
    const html = await res.text();

    // Titles via image alt attributes (15-120 chars, exclude UI elements)
    const altMatches = html.match(/alt="([^"]{15,120})"/g) || [];
    const titles = altMatches
      .map((m) => m.slice(5, -1))
      .filter((t) => {
        const lower = t.toLowerCase();
        return (
          !lower.startsWith("opens in") &&
          !lower.includes("feedback") &&
          !lower.includes("menu") &&
          t.length > 20
        );
      });

    // Prices: > $N(.NN) <
    const priceMatches = html.match(/>\$(\d{1,5}(?:[,.]\d{2})?)</g) || [];
    const prices = priceMatches
      .map((m) => parseFloat(m.slice(2).replace(",", "")))
      .filter((p) => p > 5 && p < 10000);

    // Item URLs (best-effort — eBay HTML is messy)
    const urlMatches = html.match(/href="(https:\/\/www\.ebay\.com\/itm\/[^"?]+)/g) || [];
    const urls = Array.from(
      new Set(urlMatches.map((m) => m.slice(6))) // strip 'href="'
    );

    const items: EbayItem[] = [];
    const count = Math.min(titles.length, prices.length, maxResults);
    for (let i = 0; i < count; i++) {
      const itemUrl = urls[i];
      const itemIdMatch = itemUrl?.match(/\/itm\/(?:[^/]+\/)?(\d+)/);
      items.push({
        title: titles[i],
        soldPrice: prices[i],
        url: itemUrl,
        itemId: itemIdMatch?.[1],
      });
    }
    return items;
  } catch {
    return [];
  }
}

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  if (!checkAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const runId = await startScanRun("arbitrage", { source: "auto-scan" });
  const results = {
    ebayItemsChecked: 0,
    liquidationLotsChecked: 0,
    pairsCreated: 0,
    duplicatesSkipped: 0,
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
    // SOURCE 1: eBay sold/completed (direct scrape)
    // ═══════════════════════════════════════════════════════
    for (const cat of SCAN_CATEGORIES) {
      let scanRecord: { id: string } | null = null;
      try {
        scanRecord = await prisma.arbitrageScan.create({
          data: { source: "ebay_completed", query: cat.query, status: "running" },
        });

        const items = await scrapeEbaySold(cat.query, 25);
        results.ebayItemsChecked += items.length;
        let pairsForQuery = 0;
        let bestMarginForQuery = 0;
        const margins: number[] = [];

        for (const item of items) {
          // Estimate wholesale at 35% of sold price (industry rule of thumb)
          const estimatedWholesale = +(item.soldPrice * WHOLESALE_DISCOUNT).toFixed(2);
          const ebayFees = +(item.soldPrice * EBAY_FEE_RATE).toFixed(2);
          const estimatedProfit = +(item.soldPrice - estimatedWholesale - ebayFees).toFixed(2);
          const estimatedRoi =
            estimatedWholesale > 0 ? +((estimatedProfit / estimatedWholesale) * 100).toFixed(1) : 0;

          if (estimatedProfit < MIN_PROFIT_THRESHOLD || estimatedRoi < MIN_ROI_THRESHOLD) continue;

          // Dedupe by ebayItemId when we have one; fall back to title+price within the last 7 days
          const existing = item.itemId
            ? await prisma.arbitragePair.findFirst({ where: { ebayItemId: item.itemId } })
            : await prisma.arbitragePair.findFirst({
                where: {
                  ebayTitle: item.title,
                  ebayPrice: item.soldPrice,
                  createdAt: { gte: new Date(Date.now() - 7 * 86400000) },
                },
              });
          if (existing) {
            results.duplicatesSkipped++;
            continue;
          }

          try {
            await prisma.arbitragePair.create({
              data: {
                ebayTitle: item.title,
                ebayPrice: item.soldPrice,
                ebayUrl: item.url || null,
                ebayImageUrl: item.imageUrl || null,
                ebayItemId: item.itemId || null,
                amazonTitle: `Wholesale est. (${cat.category}): ${item.title}`,
                amazonPrice: estimatedWholesale,
                ebayFeeRate: EBAY_FEE_RATE,
                ebayFees,
                profit: estimatedProfit,
                marginPercent: estimatedRoi,
                roi: estimatedRoi,
                status: "pending",
                source: "scanner",
                category: cat.category,
                notes: `Auto-discovered from eBay sold listings. Sold $${item.soldPrice.toFixed(2)}, est. wholesale $${estimatedWholesale.toFixed(2)} (35% rule). Verify source pricing before listing.`,
              },
            });
            pairsForQuery++;
            results.pairsCreated++;
            margins.push(estimatedRoi);
            if (estimatedRoi > bestMarginForQuery) bestMarginForQuery = estimatedRoi;
            if (estimatedProfit > 50) results.highMarginAlerts++;
          } catch (e) {
            results.errors.push(
              `Pair create "${item.title.slice(0, 40)}": ${e instanceof Error ? e.message : e}`
            );
          }
        }

        const avgMargin =
          margins.length > 0 ? margins.reduce((a, b) => a + b, 0) / margins.length : null;

        await prisma.arbitrageScan.update({
          where: { id: scanRecord.id },
          data: {
            status: "complete",
            itemsChecked: items.length,
            pairsFound: pairsForQuery,
            avgMargin,
            bestMargin: bestMarginForQuery || null,
            completedAt: new Date(),
          },
        });

        results.scans.push({
          source: "ebay_completed",
          query: cat.query,
          items: items.length,
          pairs: pairsForQuery,
        });
      } catch (e) {
        const msg = `eBay "${cat.query}": ${e instanceof Error ? e.message : e}`;
        results.errors.push(msg);
        if (scanRecord) {
          await prisma.arbitrageScan
            .update({
              where: { id: scanRecord.id },
              data: { status: "error", error: msg, completedAt: new Date() },
            })
            .catch(() => {});
        }
      }
    }

    // ═══════════════════════════════════════════════════════
    // SOURCE 2: Liquidation sites (best-effort via research worker)
    // Skipped gracefully when worker is unreachable — endpoints
    // /scrape/liquidation/* are not currently implemented on the
    // research worker; left here for when they're built.
    // ═══════════════════════════════════════════════════════
    const liquidationSources = [
      { name: "bulq", endpoint: "/scrape/liquidation/bulq" },
      { name: "directliquidation", endpoint: "/scrape/liquidation/directliquidation" },
      { name: "bstock", endpoint: "/scrape/liquidation/bstock" },
    ];

    for (const source of liquidationSources) {
      let scanRecord: { id: string } | null = null;
      try {
        scanRecord = await prisma.arbitrageScan.create({
          data: { source: source.name, status: "running" },
        });

        const liqRes = await fetch(`${RESEARCH_WORKER_URL}${source.endpoint}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-sync-secret": process.env.SYNC_SECRET || "",
          },
          body: JSON.stringify({ maxResults: 20, minDiscount: 50 }),
          signal: AbortSignal.timeout(15000),
        });

        if (!liqRes.ok) {
          // Most common case: endpoint not implemented (404). Note it and move on.
          const note = `${source.name} unavailable (HTTP ${liqRes.status}) — endpoint not implemented on research worker`;
          results.errors.push(note);
          await prisma.arbitrageScan.update({
            where: { id: scanRecord.id },
            data: {
              status: "skipped",
              error: note,
              completedAt: new Date(),
            },
          });
          continue;
        }

        const liqData = await liqRes.json();
        const lots: LiquidationLot[] = liqData.lots || [];
        results.liquidationLotsChecked += lots.length;
        let pairsForSource = 0;

        for (const lot of lots) {
          if (!lot.retailValue || lot.retailValue <= 0 || lot.price <= 0) continue;
          const margin = ((lot.retailValue - lot.price) / lot.price) * 100;
          const profit = lot.retailValue * (1 - EBAY_FEE_RATE) - lot.price;

          if (profit < MIN_PROFIT_THRESHOLD || margin < MIN_ROI_THRESHOLD) continue;

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
                notes: `Liquidation lot from ${source.name}. Buy $${lot.price}, retail $${lot.retailValue}.${lot.itemCount ? ` ${lot.itemCount} items.` : ""}`,
              },
            });
            pairsForSource++;
            results.pairsCreated++;
            if (profit > 100) results.highMarginAlerts++;
          } catch {
            results.duplicatesSkipped++;
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
      } catch (e) {
        const msg = `${source.name}: ${e instanceof Error ? e.message : e}`;
        results.errors.push(msg);
        if (scanRecord) {
          await prisma.arbitrageScan
            .update({
              where: { id: scanRecord.id },
              data: { status: "error", error: msg, completedAt: new Date() },
            })
            .catch(() => {});
        }
      }
    }

    // ═══════════════════════════════════════════════════════
    // SUMMARY → TrendSignal + PriceSnapshots
    // ═══════════════════════════════════════════════════════
    try {
      if (results.pairsCreated >= 3) {
        const topCategory = results.scans.reduce(
          (best, s) => (s.pairs > (best?.pairs || 0) ? s : best),
          results.scans[0]
        );
        if (topCategory) {
          await prisma.trendSignal
            .create({
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
            })
            .catch(() => {});
        }
      }

      for (const scan of results.scans) {
        if (scan.source === "ebay_completed" && scan.items > 0) {
          await prisma.priceSnapshot
            .create({
              data: {
                query: scan.query,
                platform: "ebay_sold",
                price: 0,
                title: `${scan.query}: ${scan.items} items, ${scan.pairs} pairs`,
              },
            })
            .catch(() => {});
        }
      }
    } catch {
      /* supplementary — never fail the run */
    }

    await completeScanRun(runId, {
      itemsFound: results.pairsCreated,
      alertsGen: results.highMarginAlerts,
      error: results.errors.length > 0 ? results.errors.slice(0, 3).join("; ") : undefined,
    });

    if (results.pairsCreated > 0) {
      await logScanActivity(
        "arbitrage",
        `Arbitrage scan: ${results.pairsCreated} profitable pairs found (${results.highMarginAlerts} high-margin, ${results.duplicatesSkipped} dupes)`,
        {
          event: "discovery",
          severity: results.highMarginAlerts > 0 ? "alert" : "success",
          meta: results,
        }
      );
    }

    const summary = `Checked ${results.ebayItemsChecked} eBay items + ${results.liquidationLotsChecked} liquidation lots → ${results.pairsCreated} pairs (${results.duplicatesSkipped} dupes skipped, ${results.errors.length} errors)`;
    await logScanActivity("arbitrage", `Arbitrage scan complete: ${summary}`, {
      event: "scan_complete",
      severity: results.pairsCreated > 0 ? "success" : "warning",
      meta: results,
    });

    return NextResponse.json({ ok: true, ...results });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await completeScanRun(runId, { error: msg });
    await logScanActivity("arbitrage", `Arbitrage scan failed: ${msg}`, {
      event: "error",
      severity: "alert",
    });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
