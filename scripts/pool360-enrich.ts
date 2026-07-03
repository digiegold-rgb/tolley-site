/**
 * Pool360 Product Enrichment — API-based
 *
 * Uses Pool360's internal JSON APIs to fetch product details:
 * - Description, Feature bullets, Specifications
 * - SDS/Safety Data Sheet PDF links
 * - UPC, Weight, Dimensions, Warranty
 *
 * Much faster than page scraping (~500ms per product vs ~10s).
 * Uses authenticated Playwright session to make API calls.
 *
 * Usage:
 *   npx tsx scripts/pool360-enrich.ts              # enrich un-enriched products
 *   npx tsx scripts/pool360-enrich.ts --all         # re-enrich everything
 *   npx tsx scripts/pool360-enrich.ts --sku ABC-123 # single product
 *   npx tsx scripts/pool360-enrich.ts --limit 500   # max products per run
 */

import { chromium, type Page } from "playwright";
import path from "path";

const POOL360_BASE = "https://www.pool360.com";
const BROWSER_PROFILE_DIR = path.join(
  process.env.HOME || "/home/jelly",
  ".pool360-profile"
);

const SYNC_URL = process.env.SYNC_URL || "https://www.tolley.io";
const SYNC_SECRET = process.env.SYNC_SECRET;

const ALL_MODE = process.argv.includes("--all");
const SINGLE_SKU = process.argv.includes("--sku")
  ? process.argv[process.argv.indexOf("--sku") + 1]
  : null;
const LIMIT = process.argv.includes("--limit")
  ? parseInt(process.argv[process.argv.indexOf("--limit") + 1]) || 500
  : 500;

interface EnrichedData {
  sku: string;
  description: string | null;
  features: string | null;
  specs: string | null;
  upc: string | null;
  sdsUrl: string | null;
  warranty: string | null;
  weight: string | null;
  dimensions: string | null;
  stockQty: number | null;
}

function randomDelay(minMs: number, maxMs: number): Promise<void> {
  const ms = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  return new Promise((r) => setTimeout(r, ms));
}

async function lookupProductId(page: Page, sku: string): Promise<string | null> {
  const result = await page.evaluate(
    "fetch('" + POOL360_BASE + "/api/v1/autocomplete?query=" + encodeURIComponent(sku) + "').then(function(r){return r.json();})"
  );
  const data = result as { products?: { id: string; erpNumber: string }[] };
  if (!data.products || data.products.length === 0) return null;
  // Find exact SKU match
  const match = data.products.find((p) => p.erpNumber === sku);
  return match?.id || data.products[0]?.id || null;
}

async function fetchProductDetail(page: Page, productId: string): Promise<Record<string, unknown> | null> {
  const result = await page.evaluate(
    "fetch('" + POOL360_BASE + "/api/v2/products/" + productId + "?expand=detail,specifications,content,images,documents,attributes,properties').then(function(r){return r.json();})"
  );
  return result as Record<string, unknown> | null;
}

async function enrichProduct(page: Page, sku: string): Promise<EnrichedData | null> {
  // Step 1: Lookup product UUID
  const productId = await lookupProductId(page, sku);
  if (!productId) return null;

  // Step 2: Fetch full product detail
  const detail = await fetchProductDetail(page, productId);
  if (!detail) return null;

  // Extract description from content HTML
  const content = detail.content as { htmlContent?: string } | undefined;
  let description = "";
  if (content?.htmlContent) {
    description = content.htmlContent
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/\s+/g, " ")
      .trim();
  }

  // Extract UPC from detail object
  const detailObj = detail.detail as { upcCode?: string; sku?: string } | undefined;
  const upc = detailObj?.upcCode || null;

  // Extract specifications from attributeTypes (not specifications array — it's always empty)
  const attrTypes = detail.attributeTypes as { label: string; attributeValues?: { valueDisplay: string }[] }[] | undefined;
  const specs: Record<string, string> = {};
  if (attrTypes) {
    for (const attr of attrTypes) {
      if (attr.attributeValues && attr.attributeValues.length > 0 && attr.label) {
        const val = attr.attributeValues.map((v) => v.valueDisplay).join(", ");
        if (val) specs[attr.label] = val;
      }
    }
  }
  const specsFormatted = Object.entries(specs)
    .map(([k, v]) => k + ": " + v)
    .join("\n");

  // Extract documents (SDS PDFs)
  const documents = detail.documents as { name: string; filePath: string; documentType?: string }[] | undefined;
  const docs = documents || [];
  const sdsDoc = docs.find((d) => d.documentType === "SDS" || d.name.toLowerCase().includes("sds")) || docs[0];

  // Extract feature bullets from properties
  const properties = detail.properties as Record<string, string> | undefined;
  const featuredBullets = properties?.featuredBullets || "";
  const featureLines = featuredBullets
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  // Fallback: short description from properties
  if (!description && properties?.shortDescription) {
    description = properties.shortDescription;
  }

  return {
    sku,
    description: description || null,
    features: featureLines.length > 0 ? featureLines.join("\n") : null,
    specs: specsFormatted || null,
    upc: upc || specs["UPC Code"] || null,
    sdsUrl: sdsDoc?.filePath || null,
    warranty: specs["Warranty - General"] || specs["Warranty"] || null,
    weight: specs["Each Product Weight"] || specs["Weight"] || null,
    dimensions: specs["Shipping Dimensions"] || specs["Dimensions"] || null,
    stockQty: null,
  };
}

async function fetchProducts(): Promise<{ sku: string; name: string; enrichedAt: string | null }[]> {
  const url = SYNC_URL + "/api/pools/items?status=all";
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch: " + res.status);
  return res.json();
}

async function postEnrichment(data: EnrichedData): Promise<boolean> {
  if (!SYNC_SECRET) return false;
  const url = SYNC_URL + "/api/pools/enrich";
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + SYNC_SECRET,
    },
    body: JSON.stringify(data),
  });
  return res.ok;
}

async function main() {
  console.log("[main] Pool360 Product Enrichment (API) — " + new Date().toISOString());
  console.log("[main] Mode: " + (SINGLE_SKU ? "single (" + SINGLE_SKU + ")" : ALL_MODE ? "all" : "un-enriched") + ", limit: " + LIMIT);

  if (!SYNC_SECRET) {
    console.error("[main] SYNC_SECRET required");
    process.exit(1);
  }

  let products = await fetchProducts();
  console.log("[main] Total products: " + products.length);

  if (SINGLE_SKU) {
    products = products.filter((p) => p.sku === SINGLE_SKU);
  } else if (!ALL_MODE) {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    products = products.filter((p) => !p.enrichedAt || p.enrichedAt < thirtyDaysAgo);
  }

  products = products.slice(0, LIMIT);
  console.log("[main] Products to enrich: " + products.length);

  if (products.length === 0) {
    console.log("[main] Nothing to enrich.");
    return;
  }

  let enriched = 0;
  let failed = 0;
  let consecutiveFails = 0;

  // Launch/relaunch browser session
  async function launchSession() {
    const ctx = await chromium.launchPersistentContext(BROWSER_PROFILE_DIR, {
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    });
    const pg = ctx.pages()[0] || (await ctx.newPage());
    await pg.goto(POOL360_BASE, { waitUntil: "domcontentloaded" });
    await randomDelay(2000, 3000);
    return { ctx, pg };
  }

  let session = await launchSession();
  console.log("[main] Browser session started");

  try {
    for (let i = 0; i < products.length; i++) {
      const p = products[i];
      if (i % 100 === 0 && i > 0) {
        console.log("[main] Progress: " + i + "/" + products.length + " (" + enriched + " enriched, " + failed + " failed)");
      }

      try {
        const data = await enrichProduct(session.pg, p.sku);
        if (data && (data.description || data.specs || data.upc)) {
          const ok = await postEnrichment(data);
          if (ok) {
            enriched++;
            consecutiveFails = 0;
            if (enriched <= 20 || enriched % 100 === 0) {
              const parts = [];
              if (data.description) parts.push("desc");
              if (data.specs) parts.push("specs");
              if (data.upc) parts.push("upc");
              if (data.sdsUrl) parts.push("sds");
              if (data.features) parts.push("feat");
              console.log("[ok] " + p.sku + " — " + parts.join(", "));
            }
          } else {
            failed++;
            consecutiveFails++;
          }
        } else {
          failed++;
          consecutiveFails++;
        }
      } catch (err) {
        failed++;
        consecutiveFails++;
        if (consecutiveFails <= 3) {
          const msg = err instanceof Error ? err.message : "Unknown";
          console.warn("[fail] " + p.sku + " — " + msg);
        }
      }

      // If 5+ consecutive failures, session probably died — relaunch
      if (consecutiveFails >= 5) {
        console.log("[main] Session died after " + consecutiveFails + " consecutive failures. Relaunching...");
        try { await session.ctx.close(); } catch {}
        await randomDelay(3000, 5000);
        session = await launchSession();
        consecutiveFails = 0;
        console.log("[main] Session relaunched. Continuing from product " + (i + 1));
      }

      if (i % 10 === 0) await randomDelay(300, 600);
    }
  } finally {
    try { await session.ctx.close(); } catch {}
  }

  console.log("[main] Done. Enriched: " + enriched + ", Failed: " + failed + " of " + products.length);
}

main().catch((err) => {
  console.error("[main] Fatal:", err);
  process.exit(1);
});
