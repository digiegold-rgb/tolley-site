/**
 * TURBO Shop Intelligence Engine
 *
 * Scans unconventional sources other resellers DON'T watch.
 * Logs progress to ScanActivity for real-time dashboard updates.
 *
 * WORKING SOURCES:
 *  1. Direct eBay sold scraping (20+ niche categories, no API needed)
 *  2. Google Custom Search API — rising demand signals, Reddit, Goodwill, GovDeals
 *  3. AI cross-reference via local Qwen3.5 (DGX) or research worker
 *  4. Price snapshots + margin monitoring + stale inventory + lot P&L
 */

import { prisma } from "@/lib/prisma";
import { logScanActivity } from "@/lib/scan/log";

const GOOGLE_SEARCH_API_KEY = process.env.GOOGLE_SEARCH_API_KEY || "";
const GOOGLE_SEARCH_ENGINE_ID = process.env.GOOGLE_SEARCH_ENGINE_ID || "";
const RESEARCH_WORKER_URL = process.env.RESEARCH_WORKER_URL || "http://localhost:8900";
const STALE_DAYS = 30;
const MIN_MARGIN_ALERT = 10;

export interface IntelligenceResult {
  snapshotsCaptured: number;
  trendsCreated: number;
  staleItems: number;
  marginAlerts: number;
  lotsUpdated: number;
  sourcesScanned: number;
  errors: string[];
}

async function logProgress(phase: string, detail: string, meta?: Record<string, unknown>) {
  await logScanActivity("arbitrage", `[TURBO] ${phase}: ${detail}`, {
    event: "scan_progress",
    severity: "info",
    meta: { ...meta, phase },
  });
}

// ═══════════════════════════════════════════════════════════════
// NICHE CATEGORIES — stuff nobody else scans
// ═══════════════════════════════════════════════════════════════

const NICHE_EBAY_QUERIES = [
  "discontinued apple product sealed",
  "vintage sony walkman working",
  "texas instruments calculator lot",
  "vintage pyrex mixing bowl",
  "vintage board game sealed",
  "antique cast iron cookware",
  "vintage corningware lot",
  "mcm furniture mid century",
  "medical equipment lot surplus",
  "commercial kitchen equipment",
  "vintage sewing machine working",
  "vintage camera lens lot",
  "vintage audio receiver working",
  "vintage video game console lot",
  "printer ink cartridge lot new",
  "industrial tooling lot",
  ...getSeasonalQueries(),
];

const GOOGLE_TREND_QUERIES = [
  "where to buy discontinued",
  "sold out everywhere 2026",
  "tiktok made me buy",
  "viral product 2026",
  "recalled product worth money",
  "limited edition sold out",
  "store closing sale near me",
  "liquidation pallets",
  "going out of business sale",
];

const REDDIT_QUERIES = [
  "site:reddit.com/r/Flipping what sells best",
  "site:reddit.com/r/Flipping profit haul",
  "site:reddit.com/r/ThriftStoreHauls valuable find",
  "site:reddit.com/r/Flipping trending",
  "site:reddit.com/r/dealsreddit clearance",
];

const UNCONVENTIONAL_QUERIES = [
  "site:shopgoodwill.com electronics lot",
  "site:shopgoodwill.com vintage collection",
  "site:govdeals.com surplus electronics",
  "site:estatesales.net upcoming estate sale",
  "site:storagetreasures.com auction",
  "manufacturer refurbished closeout deals",
  "site:alibaba.com trending product USA 2026",
];

function getSeasonalQueries(): string[] {
  const month = new Date().getMonth();
  const seasonal: Record<number, string[]> = {
    0: ["fitness equipment lot", "organization supplies lot"],
    1: ["valentines gift lot", "wedding decor wholesale"],
    2: ["garden tools lot", "easter decor lot", "spring cleaning lot"],
    3: ["outdoor furniture lot", "camping gear lot"],
    4: ["summer toys lot", "pool accessories lot"],
    5: ["beach gear lot", "outdoor games lot"],
    6: ["back to school supplies lot", "dorm room essentials"],
    7: ["fall decor lot", "halloween costume lot"],
    8: ["halloween decor lot", "space heater lot"],
    9: ["thanksgiving decor lot", "winter coat lot"],
    10: ["christmas decor lot", "holiday gift lot"],
    11: ["christmas clearance lot", "winter gear lot"],
  };
  return seasonal[month] || [];
}

// ═══════════════════════════════════════════════════════════════
// DIRECT EBAY SCRAPING — works from Vercel, no API key needed
// ═══════════════════════════════════════════════════════════════

interface EbaySoldItem {
  title: string;
  price: number;
}

async function scrapeEbaySold(query: string): Promise<EbaySoldItem[]> {
  try {
    const url = `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(query)}&LH_Complete=1&LH_Sold=1&_ipg=25`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) return [];
    const html = await res.text();

    // Extract item titles from image alt attributes
    const altMatches = html.match(/alt="([^"]{15,120})"/g) || [];
    const titles = altMatches
      .map((m) => m.slice(5, -1))
      .filter((t) => {
        const lower = t.toLowerCase();
        // Filter to actual product titles (contain meaningful words, not UI elements)
        return !lower.startsWith("opens in") && !lower.includes("feedback") &&
               !lower.includes("menu") && t.length > 20;
      });

    // Extract prices
    const priceMatches = html.match(/>\$(\d{1,5}(?:[,.]\d{2})?)</g) || [];
    const prices = priceMatches
      .map((m) => parseFloat(m.slice(2).replace(",", "")))
      .filter((p) => p > 2 && p < 10000);

    // Pair titles with prices
    const items: EbaySoldItem[] = [];
    const count = Math.min(titles.length, prices.length, 15);
    for (let i = 0; i < count; i++) {
      items.push({ title: titles[i], price: prices[i] });
    }

    return items;
  } catch {
    return [];
  }
}

// ═══════════════════════════════════════════════════════════════
// GOOGLE CUSTOM SEARCH
// ═══════════════════════════════════════════════════════════════

interface GoogleResult {
  title: string;
  snippet: string;
  link: string;
}

async function googleSearch(query: string, num = 5): Promise<GoogleResult[]> {
  if (!GOOGLE_SEARCH_API_KEY || !GOOGLE_SEARCH_ENGINE_ID) return [];
  try {
    const url = `https://www.googleapis.com/customsearch/v1?key=${GOOGLE_SEARCH_API_KEY}&cx=${GOOGLE_SEARCH_ENGINE_ID}&q=${encodeURIComponent(query)}&num=${num}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) {
      const err = await res.text().catch(() => "");
      throw new Error(`Google API ${res.status}: ${err.slice(0, 200)}`);
    }
    const data = await res.json();
    return (data.items || []).map((item: { title: string; snippet: string; link: string }) => ({
      title: item.title,
      snippet: item.snippet,
      link: item.link,
    }));
  } catch (e) {
    throw e; // Let caller handle — don't swallow
  }
}

// ═══════════════════════════════════════════════════════════════
// AI TREND SYNTHESIS
// ═══════════════════════════════════════════════════════════════

interface AiTrend {
  category: string;
  signalType: string;
  title: string;
  body: string;
  confidence: number;
  estimatedMargin: string;
}

async function aiAnalyzeTrends(signals: string): Promise<AiTrend[]> {
  const prompt = `You are an expert retail arbitrage analyst. Analyze these raw intelligence signals and extract the TOP actionable trends for a reseller in Kansas City.

Focus on: rising demand + low competition, price gaps between source and sell, seasonal timing, viral items, discontinued products.

${signals}

Return JSON only: {"trends":[{"category":"specific product","signalType":"hot_category|price_spike|sell_through_high|seasonal_peak|viral","title":"short title","body":"why + where to source","confidence":0.0-1.0,"estimatedMargin":"e.g. 40-60%"}]}
5-15 trends, ranked by profit. Only genuinely actionable.`;

  // Try research worker's AI endpoint first
  try {
    const res = await fetch(`${RESEARCH_WORKER_URL}/ai-extract`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-sync-secret": process.env.SYNC_SECRET || "" },
      body: JSON.stringify({ prompt, format: "json" }),
      signal: AbortSignal.timeout(60000),
    });
    if (res.ok) {
      const data = await res.json();
      const content = typeof data === "string" ? data : JSON.stringify(data);
      const match = content.match(/\{[\s\S]*\}/);
      if (match) return JSON.parse(match[0]).trends || [];
    }
  } catch { /* fall through */ }

  // Fallback: direct vLLM (works when running on DGX)
  try {
    const vllmUrl = process.env.VLLM_URL || "http://127.0.0.1:8355/v1";
    const res = await fetch(`${vllmUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "Qwen/Qwen3.5-35B-A3B-FP8",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.4,
        max_tokens: 2000,
      }),
      signal: AbortSignal.timeout(60000),
    });
    if (res.ok) {
      const data = await res.json();
      const content = data.choices?.[0]?.message?.content || "";
      const match = content.match(/\{[\s\S]*\}/);
      if (match) return JSON.parse(match[0]).trends || [];
    }
  } catch { /* fall through */ }

  return [];
}

// ═══════════════════════════════════════════════════════════════
// MAIN ENGINE
// ═══════════════════════════════════════════════════════════════

export async function runShopIntelligence(): Promise<IntelligenceResult> {
  const result: IntelligenceResult = {
    snapshotsCaptured: 0,
    trendsCreated: 0,
    staleItems: 0,
    marginAlerts: 0,
    lotsUpdated: 0,
    sourcesScanned: 0,
    errors: [],
  };

  const allSignals: string[] = [];

  await logProgress("INIT", `Starting turbo scan — ${NICHE_EBAY_QUERIES.length} eBay + ${GOOGLE_TREND_QUERIES.length + REDDIT_QUERIES.length + UNCONVENTIONAL_QUERIES.length} Google searches`);

  // ─── 1. DIRECT EBAY SOLD SCRAPING ─────────────────────
  await logProgress("EBAY_NICHE", `Scraping ${NICHE_EBAY_QUERIES.length} niche categories from eBay sold listings...`);
  let ebaySignals = 0;

  for (const query of NICHE_EBAY_QUERIES) {
    try {
      const items = await scrapeEbaySold(query);
      result.sourcesScanned++;

      if (items.length >= 3) {
        const prices = items.map((i) => i.price);
        const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
        const high = Math.max(...prices);
        const low = Math.min(...prices);

        // Compare to previous scan
        const prev = await prisma.priceSnapshot.findFirst({
          where: { query, platform: "ebay_sold" },
          orderBy: { capturedAt: "desc" },
        });
        const change = prev && prev.price > 0 ? ((avg - prev.price) / prev.price) * 100 : 0;

        // Store snapshot
        await prisma.priceSnapshot.create({
          data: { query, platform: "ebay_sold", price: avg, title: `${query} (${items.length} sold, $${low.toFixed(0)}-$${high.toFixed(0)}, avg $${avg.toFixed(2)})` },
        });
        result.snapshotsCaptured++;

        // Build signal for AI
        allSignals.push(`EBAY SOLD "${query}": ${items.length} items, avg $${avg.toFixed(2)}, range $${low}-$${high}${change ? `, ${change > 0 ? "UP" : "DOWN"} ${Math.abs(change).toFixed(0)}%` : " (first scan)"}. Top: ${items.slice(0, 3).map((i) => `"${i.title.slice(0, 50)}" $${i.price}`).join(", ")}`);

        // Create trend signal if notable
        if (Math.abs(change) > 12 || items.length >= 10) {
          await prisma.trendSignal.create({
            data: {
              category: query,
              platform: "ebay",
              signalType: change > 12 ? "price_spike" : "sell_through_high",
              title: `${query}: ${items.length} sold, avg $${avg.toFixed(2)}`,
              body: change
                ? `Price ${change > 0 ? "up" : "down"} ${Math.abs(change).toFixed(0)}% since last scan. Range: $${low}-$${high}`
                : `High sell-through: ${items.length} sold recently. Range: $${low}-$${high}`,
              metric: change || items.length,
              metricLabel: change ? "% change" : "sold count",
              confidence: Math.min(items.length / 12, 1),
            },
          });
          result.trendsCreated++;
          ebaySignals++;
        }
      }
    } catch (e) {
      result.errors.push(`eBay "${query}": ${e instanceof Error ? e.message : e}`);
    }
  }
  await logProgress("EBAY_NICHE", `Done — ${result.sourcesScanned} scraped, ${ebaySignals} trend signals, ${result.snapshotsCaptured} snapshots`, { scraped: result.sourcesScanned, signals: ebaySignals });

  // ─── 2. GOOGLE TRENDS + REDDIT + UNCONVENTIONAL ───────
  const hasGoogle = !!GOOGLE_SEARCH_API_KEY && !!GOOGLE_SEARCH_ENGINE_ID;

  if (hasGoogle) {
    // Google trend queries
    await logProgress("GOOGLE", `Searching ${GOOGLE_TREND_QUERIES.length} rising demand queries...`);
    let googleHits = 0;
    for (const query of GOOGLE_TREND_QUERIES) {
      try {
        const results = await googleSearch(query);
        result.sourcesScanned++;
        if (results.length > 0) {
          googleHits++;
          allSignals.push(`GOOGLE RISING: "${query}" — ${results.length} results: ${results.slice(0, 2).map((r) => `${r.title} (${r.snippet.slice(0, 80)})`).join(" | ")}`);
          await prisma.priceSnapshot.create({ data: { query, platform: "google_trends", price: results.length, title: `Google: "${query}" (${results.length} hits)` } });
          result.snapshotsCaptured++;
        }
      } catch (e) {
        result.errors.push(`Google "${query}": ${e instanceof Error ? e.message : e}`);
      }
    }
    await logProgress("GOOGLE", `Done — ${googleHits}/${GOOGLE_TREND_QUERIES.length} returned results`, { hits: googleHits });

    // Reddit
    await logProgress("REDDIT", `Scanning ${REDDIT_QUERIES.length} Reddit communities...`);
    let redditHits = 0;
    for (const query of REDDIT_QUERIES) {
      try {
        const results = await googleSearch(query, 3);
        result.sourcesScanned++;
        if (results.length > 0) {
          redditHits++;
          allSignals.push(`REDDIT: ${results.map((r) => `${r.title}: ${r.snippet.slice(0, 100)}`).join(" | ")}`);
        }
      } catch (e) {
        result.errors.push(`Reddit: ${e instanceof Error ? e.message : e}`);
      }
    }
    await logProgress("REDDIT", `Done — ${redditHits} threads found`, { hits: redditHits });

    // Unconventional
    await logProgress("UNCONVENTIONAL", `Scanning Goodwill, GovDeals, estates, Alibaba...`);
    let unconvHits = 0;
    for (const query of UNCONVENTIONAL_QUERIES) {
      try {
        const results = await googleSearch(query, 3);
        result.sourcesScanned++;
        if (results.length > 0) {
          unconvHits++;
          allSignals.push(`HIDDEN SOURCE: "${query}" — ${results.map((r) => `${r.title}: ${r.snippet.slice(0, 80)}`).join(" | ")}`);
        }
      } catch (e) {
        result.errors.push(`Unconventional: ${e instanceof Error ? e.message : e}`);
      }
    }
    await logProgress("UNCONVENTIONAL", `Done — ${unconvHits} sources found`, { hits: unconvHits });
  } else {
    const msg = "Google Search API not configured or disabled — skipping Google/Reddit/Unconventional scans. Enable at: https://console.developers.google.com/apis/api/customsearch.googleapis.com/overview";
    await logProgress("GOOGLE", msg);
    await logProgress("REDDIT", "Skipped (needs Google API)");
    await logProgress("UNCONVENTIONAL", "Skipped (needs Google API)");
    result.errors.push(msg);
  }

  // ─── 3. AI CROSS-REFERENCE ─────────────────────────────
  if (allSignals.length >= 3) {
    await logProgress("AI_SYNTHESIS", `Sending ${allSignals.length} signals to AI for cross-reference...`);
    try {
      const aiTrends = await aiAnalyzeTrends(allSignals.join("\n\n"));
      if (aiTrends.length > 0) {
        for (const trend of aiTrends) {
          await prisma.trendSignal.create({
            data: {
              category: trend.category,
              platform: "ai_synthesis",
              signalType: trend.signalType || "hot_category",
              title: trend.title,
              body: `${trend.body}${trend.estimatedMargin ? ` | Est. margin: ${trend.estimatedMargin}` : ""}`,
              confidence: trend.confidence,
              metric: trend.confidence * 100,
              metricLabel: "AI confidence",
            },
          });
          result.trendsCreated++;
        }
        await logProgress("AI_SYNTHESIS", `Done — ${aiTrends.length} actionable trends generated`, { trendCount: aiTrends.length });
      } else {
        await logProgress("AI_SYNTHESIS", "AI returned no actionable trends");
      }
    } catch (e) {
      const msg = `AI: ${e instanceof Error ? e.message : e}`;
      result.errors.push(msg);
      await logProgress("AI_SYNTHESIS", `Failed: ${msg}`);
    }
  } else {
    await logProgress("AI_SYNTHESIS", `Only ${allSignals.length} signals — need at least 3 for AI synthesis`);
  }

  // ─── 4. INVENTORY SNAPSHOTS ────────────────────────────
  await logProgress("SNAPSHOTS", "Capturing inventory price snapshots...");
  try {
    const listings = await prisma.platformListing.findMany({
      where: { status: "active" },
      include: { product: { select: { id: true, title: true } } },
    });
    for (const l of listings) {
      await prisma.priceSnapshot.create({ data: { productId: l.productId, platform: l.platform, price: l.price, title: l.product.title } });
      result.snapshotsCaptured++;
    }
    await logProgress("SNAPSHOTS", `Done — ${listings.length} snapshots`);
  } catch (e) {
    result.errors.push(`Snapshots: ${e}`);
  }

  // ─── 5. MARGIN MONITORING ─────────────────────────────
  await logProgress("MARGINS", "Checking margin thresholds...");
  try {
    const products = await prisma.product.findMany({
      where: { status: "listed", totalCogs: { not: null } },
      include: { listings: { where: { status: "active" } } },
    });
    for (const p of products) {
      if (!p.totalCogs) continue;
      for (const l of p.listings) {
        if (((l.price - p.totalCogs) / l.price) * 100 < MIN_MARGIN_ALERT) result.marginAlerts++;
      }
    }
    await logProgress("MARGINS", `Done — ${result.marginAlerts} alerts`);
  } catch (e) { result.errors.push(`Margins: ${e}`); }

  // ─── 6. STALE INVENTORY ───────────────────────────────
  await logProgress("STALE", "Flagging stale inventory...");
  try {
    result.staleItems = await prisma.product.count({ where: { status: "listed", createdAt: { lt: new Date(Date.now() - STALE_DAYS * 86400000) } } });
    await logProgress("STALE", `Done — ${result.staleItems} items listed 30+ days`);
  } catch (e) { result.errors.push(`Stale: ${e}`); }

  // ─── 7. LOT P&L ──────────────────────────────────────
  await logProgress("LOTS", "Recomputing lot P&L...");
  try {
    const lots = await prisma.sourceLot.findMany({ where: { status: { not: "complete" } }, include: { products: true } });
    for (const lot of lots) {
      const sold = lot.products.filter((p) => p.status === "sold");
      const listed = lot.products.filter((p) => p.status === "listed");
      await prisma.sourceLot.update({
        where: { id: lot.id },
        data: {
          totalSold: sold.reduce((s, p) => s + (p.soldPrice || 0), 0),
          totalProfit: sold.reduce((s, p) => s + (p.netProfit || 0), 0),
          itemsSold: sold.length,
          itemsListed: listed.length + sold.length,
          status: lot.products.length > 0 && sold.length === lot.products.length ? "complete" : listed.length > 0 ? "listed" : lot.status,
        },
      });
      result.lotsUpdated++;
    }
    await logProgress("LOTS", `Done — ${result.lotsUpdated} lots updated`);
  } catch (e) { result.errors.push(`Lots: ${e}`); }

  // Expire old signals
  await prisma.trendSignal.updateMany({
    where: { status: "active", createdAt: { lt: new Date(Date.now() - 7 * 86400000) } },
    data: { status: "expired" },
  }).catch(() => {});

  await logProgress("COMPLETE", `Turbo scan done: ${result.sourcesScanned} sources, ${result.trendsCreated} trends, ${result.snapshotsCaptured} snapshots, ${result.errors.length} errors`, result as unknown as Record<string, unknown>);

  return result;
}
