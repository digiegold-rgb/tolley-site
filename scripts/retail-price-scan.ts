/**
 * Retail Competitor Price Scanner
 *
 * Scrapes Leslie's, In The Swim, and Google Shopping for competitor retail prices.
 * POSTs matched prices to /api/pools/competitor-prices.
 *
 * Usage:
 *   npx tsx scripts/retail-price-scan.ts              # full scan
 *   npx tsx scripts/retail-price-scan.ts --quick       # top 100 products only
 *   npx tsx scripts/retail-price-scan.ts --sku ABC-123 # single product
 *
 * Env vars:
 *   SYNC_URL     — override base URL (default: https://www.tolley.io)
 *   SYNC_SECRET  — bearer token (required)
 */

import { chromium, type Page, type BrowserContext } from "playwright";
import path from "path";

// ── Config ──────────────────────────────────────────────────────────────────

const BASE_URL = process.env.SYNC_URL || "https://www.tolley.io";
const SYNC_SECRET = process.env.SYNC_SECRET;
const QUICK_MODE = process.argv.includes("--quick");
const SINGLE_SKU = process.argv.includes("--sku")
  ? process.argv[process.argv.indexOf("--sku") + 1]
  : null;

const BROWSER_PROFILE_DIR = path.join(
  process.env.HOME || "/home/jelly",
  ".retail-scrape-profile"
);

interface OurProduct {
  sku: string;
  name: string;
  brand: string | null;
  upc: string | null;
  mfgPart: string | null;
  costPrice: number | null;
  price: number;
}

interface ScrapedPrice {
  sku: string;
  competitor: string;
  price: number;
  url?: string;
  productName?: string;
  matchType: string;
  matchScore?: number;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function randomDelay(minMs: number, maxMs: number): Promise<void> {
  const ms = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  return new Promise((r) => setTimeout(r, ms));
}

function buildSearchQuery(product: OurProduct): string {
  const parts: string[] = [];
  if (product.brand) parts.push(product.brand);
  parts.push(product.name);
  // Limit length to avoid overly specific queries
  return parts.join(" ").slice(0, 120);
}

function parsePrice(text: string): number | null {
  const match = text.match(/\$?([\d,]+\.?\d*)/);
  if (!match) return null;
  const val = parseFloat(match[1].replace(",", ""));
  return isNaN(val) || val <= 0 ? null : val;
}

/** Tokenize a product name into meaningful words for comparison. */
function tokenize(s: string): Set<string> {
  return new Set(
    s.toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2 && !["the", "and", "for", "with", "per", "box", "each", "pack"].includes(w))
  );
}

/** Jaccard similarity between two product names (0–1). */
function nameSimilarity(a: string, b: string): number {
  const setA = tokenize(a);
  const setB = tokenize(b);
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersection = 0;
  for (const w of setA) {
    if (setB.has(w)) intersection++;
  }
  return intersection / (setA.size + setB.size - intersection);
}

/** Price sanity check — reject if competitor price is wildly off from our cost. */
function priceSanityCheck(competitorPrice: number, ourCost: number): boolean {
  if (ourCost <= 0) return true;
  // Reject if competitor price is >5x or <0.1x our cost — almost certainly a mismatch
  const ratio = competitorPrice / ourCost;
  return ratio >= 0.1 && ratio <= 5.0;
}

// ── Leslie's Pool Supplies ──────────────────────────────────────────────────

async function scrapeLeslies(
  page: Page,
  product: OurProduct
): Promise<ScrapedPrice | null> {
  try {
    const query = product.upc || buildSearchQuery(product);
    const searchUrl = `https://www.lesliespool.com/search?q=${encodeURIComponent(query)}`;
    await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 15000 });
    await randomDelay(2000, 4000);

    // Wait for search results
    try {
      await page.waitForSelector('[data-testid="product-card"], .product-tile, .search-result-item', { timeout: 8000 });
    } catch {
      // No results or page didn't load
      return null;
    }

    // Extract first result's price and name
    const result = await page.evaluate(() => {
      // Try multiple selectors for Leslie's search results
      const priceEl =
        document.querySelector('[data-testid="product-card"] .price') ||
        document.querySelector('.product-tile .price') ||
        document.querySelector('.search-result-item .price') ||
        document.querySelector('[class*="price"]');

      const nameEl =
        document.querySelector('[data-testid="product-card"] a') ||
        document.querySelector('.product-tile a') ||
        document.querySelector('.search-result-item a');

      const linkEl =
        document.querySelector('[data-testid="product-card"] a[href*="/"]') ||
        document.querySelector('.product-tile a[href*="/"]');

      if (!priceEl) return null;

      return {
        price: priceEl.textContent?.trim() || "",
        name: nameEl?.textContent?.trim() || "",
        url: linkEl?.getAttribute("href") || "",
      };
    });

    if (!result || !result.price) return null;

    const price = parsePrice(result.price);
    if (!price) return null;

    // Validate match quality
    const isUpcSearch = !!product.upc;
    let matchScore = isUpcSearch ? 1.0 : 0;
    let matchType = isUpcSearch ? "upc" : "fuzzy_name";

    if (!isUpcSearch && result.name) {
      matchScore = nameSimilarity(product.name, result.name);
      if (matchScore < 0.25) {
        // Too different — likely wrong product
        return null;
      }
    }

    // Sanity check price against our cost
    if (product.costPrice && !priceSanityCheck(price, product.costPrice)) {
      return null;
    }

    return {
      sku: product.sku,
      competitor: "leslies",
      price,
      url: result.url ? `https://www.lesliespool.com${result.url.startsWith("/") ? result.url : "/" + result.url}` : undefined,
      productName: result.name || undefined,
      matchType,
      matchScore,
    };
  } catch (err) {
    console.warn(`[leslies] Error scraping ${product.sku}:`, err instanceof Error ? err.message : err);
    return null;
  }
}

// InTheSwim direct scraping removed — domain is parked/dead.
// Prices from InTheSwim, Walmart, Amazon, Home Depot all come via Google Shopping below.

// ── Bing Shopping (aggregates Walmart, Amazon, Home Depot, etc.) ─────────────
// Google Shopping blocks headless browsers. Bing Shopping does not.

async function scrapeBingShopping(
  page: Page,
  product: OurProduct
): Promise<ScrapedPrice[]> {
  const results: ScrapedPrice[] = [];
  try {
    const query = buildSearchQuery(product);
    const searchUrl = `https://www.bing.com/shop?q=${encodeURIComponent(query)}`;
    await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 15000 });
    await randomDelay(3000, 5000);

    // Bing Shopping card text pattern: "ProductName | $PRICE | $STRIKETHROUGH | unit | StoreName | rating"
    // Extract using regex on innerText with pipes as separators
    const items = await page.evaluate(() => {
      const body = document.body.innerText.replace(/\n/g, " | ");
      const found: { price: string; store: string; title: string }[] = [];

      // Pattern: capture text before price as product title, then price, then store
      const titleRegex = /([^|]{5,80}?)\s*\|\s*\$([\d,]+\.?\d*)(?:\s*\|\s*\$[\d,]+\.?\d*)?(?:\s*\|\s*\$[\d.]+ \/ [^|]+)?\s*\|\s*([A-Za-z][A-Za-z0-9.' ]+?)(?:\s*\||\s*\d)/g;
      let match;
      while ((match = titleRegex.exec(body)) !== null) {
        const title = match[1].trim();
        const price = match[2];
        const store = match[3].trim();
        if (store && store.length > 2 && store.length < 40) {
          found.push({ price: "$" + price, store, title });
        }
      }

      // Fallback: original pattern without title capture if nothing found
      if (found.length === 0) {
        const fallbackRegex = /\$([\d,]+\.?\d*)(?:\s*\|\s*\$[\d,]+\.?\d*)?(?:\s*\|\s*\$[\d.]+ \/ [^|]+)?\s*\|\s*([A-Za-z][A-Za-z0-9.' ]+?)(?:\s*\||\s*\d)/g;
        let fm;
        while ((fm = fallbackRegex.exec(body)) !== null) {
          const price = fm[1];
          const store = fm[2].trim();
          if (store && store.length > 2 && store.length < 40) {
            found.push({ price: "$" + price, store, title: "" });
          }
        }
      }
      return found;
    });

    const competitorMap: Record<string, string> = {
      "walmart": "walmart",
      "amazon": "amazon",
      "amazon.com": "amazon",
      "home depot": "homedepot",
      "the home depot": "homedepot",
      "lowe's": "lowes",
      "lowes": "lowes",
      "leslie's": "leslies",
      "leslies": "leslies",
      "in the swim": "intheswim",
      "intheswim": "intheswim",
      "target": "target",
      "sam's club": "samsclub",
      "ace hardware": "acehardware",
      "poolsupplyworld": "poolsupplyworld",
      "doheny's": "dohenys",
    };

    // Dedupe: keep lowest price per competitor (with sanity + name checks)
    const best = new Map<string, { price: number; name?: string; score: number }>();
    for (const item of items) {
      const price = parsePrice(item.price);
      if (!price || price <= 0) continue;

      // Price sanity check — reject wildly off prices
      if (product.costPrice && !priceSanityCheck(price, product.costPrice)) continue;

      // Name similarity check — reject if title captured and too different
      if (item.title && item.title.length > 5) {
        const sim = nameSimilarity(product.name, item.title);
        if (sim < 0.15) continue; // clearly different product
      }

      const storeLower = item.store.toLowerCase();
      let competitor = "other";
      for (const [pattern, name] of Object.entries(competitorMap)) {
        if (storeLower.includes(pattern)) {
          competitor = name;
          break;
        }
      }
      if (competitor === "other") continue;

      const sim = item.title ? nameSimilarity(product.name, item.title) : 0.5;
      const existing = best.get(competitor);
      if (!existing || price < existing.price) {
        best.set(competitor, { price, name: item.store, score: sim });
      }
    }

    for (const [competitor, data] of best) {
      results.push({
        sku: product.sku,
        competitor,
        price: data.price,
        productName: data.name || undefined,
        matchType: "fuzzy_name",
        matchScore: Math.round(data.score * 100) / 100,
      });
    }
  } catch (err) {
    console.warn(`[bing] Error scraping ${product.sku}:`, err instanceof Error ? err.message : err);
  }
  return results;
}

// ── Fetch products from API ─────────────────────────────────────────────────

async function fetchProducts(): Promise<OurProduct[]> {
  const url = `${BASE_URL}/api/pools/items?status=all`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch products: ${res.status}`);
  const items: OurProduct[] = await res.json();
  return items;
}

// ── Post results to API ─────────────────────────────────────────────────────

async function postPrices(prices: ScrapedPrice[]): Promise<void> {
  if (!SYNC_SECRET) {
    console.error("[sync] SYNC_SECRET env var required");
    process.exit(1);
  }

  const url = `${BASE_URL}/api/pools/competitor-prices`;
  console.log(`[sync] Posting ${prices.length} competitor prices to ${url}`);

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SYNC_SECRET}`,
    },
    body: JSON.stringify({ prices, runPricing: true }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error(`[sync] HTTP ${res.status}: ${text}`);
    return;
  }

  const result = await res.json();
  console.log("[sync] Result:", JSON.stringify(result, null, 2));
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`[main] Retail Price Scan — ${new Date().toISOString()}`);
  console.log(`[main] Mode: ${SINGLE_SKU ? `single SKU (${SINGLE_SKU})` : QUICK_MODE ? "quick (top 100)" : "full scan"}`);

  if (!SYNC_SECRET) {
    console.error("[main] SYNC_SECRET env var required");
    process.exit(1);
  }

  // Fetch products to scan
  let products = await fetchProducts();
  console.log(`[main] Fetched ${products.length} products`);

  // Filter: must have cost > $10 and either UPC or name
  products = products.filter(
    (p) => p.costPrice && p.costPrice > 10 && (p.upc || p.name)
  );
  console.log(`[main] ${products.length} products eligible (cost > $10, have UPC or name)`);

  if (SINGLE_SKU) {
    products = products.filter((p) => p.sku === SINGLE_SKU);
    if (products.length === 0) {
      console.error(`[main] SKU ${SINGLE_SKU} not found or not eligible`);
      process.exit(1);
    }
  }

  if (QUICK_MODE) {
    products = products.slice(0, 100);
  }

  // Prioritize: chemicals first (high volume), then equipment (high margin), then rest
  const categoryOrder: Record<string, number> = {
    Chemicals: 0,
    Equipment: 1,
    Maintenance: 2,
    Accessories: 3,
  };
  products.sort((a, b) => {
    const aOrd = categoryOrder[(a as unknown as { category?: string }).category || ""] ?? 4;
    const bOrd = categoryOrder[(b as unknown as { category?: string }).category || ""] ?? 4;
    return aOrd - bOrd;
  });

  // Launch browser
  console.log(`[main] Browser profile: ${BROWSER_PROFILE_DIR}`);
  const context = await chromium.launchPersistentContext(BROWSER_PROFILE_DIR, {
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    viewport: { width: 1920, height: 1080 },
  });
  const page = context.pages()[0] || (await context.newPage());

  const allPrices: ScrapedPrice[] = [];
  let scanned = 0;
  let matched = 0;

  try {
    for (const product of products) {
      scanned++;
      console.log(`[scan] (${scanned}/${products.length}) ${product.sku} — ${product.name.slice(0, 60)}`);

      // Scrape Leslie's (direct — pool specialty competitor)
      const lesliesResult = await scrapeLeslies(page, product);
      if (lesliesResult) {
        allPrices.push(lesliesResult);
        matched++;
        console.log(`  [leslies] $${lesliesResult.price}`);
      }
      await randomDelay(1000, 2000);

      // Scrape Bing Shopping (aggregates Walmart, Amazon, Home Depot, InTheSwim, etc.)
      const bingResults = await scrapeBingShopping(page, product);
      if (bingResults.length > 0) {
        allPrices.push(...bingResults);
        matched += bingResults.length;
        console.log(`  [bing] ${bingResults.length} results: ${bingResults.map((r) => `${r.competitor}=$${r.price}`).join(", ")}`);
      }

      // Post in batches of 50 to avoid losing progress on crash
      if (allPrices.length >= 50) {
        await postPrices(allPrices.splice(0));
      }

      await randomDelay(2000, 4000);
    }

    // Post remaining prices
    if (allPrices.length > 0) {
      await postPrices(allPrices);
    }
  } finally {
    await context.close();
  }

  console.log(`[main] Done. Scanned: ${scanned}, Matches: ${matched}`);
}

main().catch((err) => {
  console.error("[main] Fatal:", err);
  process.exit(1);
});
