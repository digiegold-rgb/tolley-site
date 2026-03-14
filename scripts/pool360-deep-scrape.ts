/**
 * Pool360 Deep Product Scraper
 *
 * Uses Pool360's internal REST API + HTML page scraping to extract:
 * - Full description (htmlContent from API)
 * - UPC code (upcCode from API)
 * - Technical specifications (from product page HTML)
 * - Safety/health documents (SDS links from API)
 * - Manufacturer part number (from API)
 *
 * Phase 1: Fast API pass — gets UPC, description, docs for all products
 * Phase 2: HTML scrape — gets specifications for products that have them
 *
 * Usage:
 *   npx tsx scripts/pool360-deep-scrape.ts
 *   npx tsx scripts/pool360-deep-scrape.ts --skip-specs   # API only, no HTML scrape
 */

import { chromium, type Page, type BrowserContext } from "playwright";
import path from "path";

const BROWSER_PROFILE_DIR = path.join(
  process.env.HOME || "/home/jelly",
  ".pool360-profile"
);

const SKIP_SPECS = process.argv.includes("--skip-specs");

function randomDelay(minMs: number, maxMs: number): Promise<void> {
  const ms = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  return new Promise((r) => setTimeout(r, ms));
}

interface APIProduct {
  sku: string;
  description: string | null;
  upc: string | null;
  mfgPart: string | null;
  sdsUrl: string | null;
  productUrl: string | null;
  productId: string | null;
}

// Phase 1: API-based data extraction (fast)
async function fetchProductAPI(
  page: Page,
  sku: string
): Promise<APIProduct | null> {
  try {
    const result = await page.evaluate(async (s: string) => {
      // Step 1: autocomplete to get product ID
      const autoRes = await fetch(
        "/api/v1/autocomplete?query=" + encodeURIComponent(s)
      );
      if (!autoRes.ok) return null;
      const autoData = await autoRes.json();
      if (!autoData.products || autoData.products.length === 0) return null;

      const product = autoData.products[0];
      const productId = product.id;
      const productUrl = product.url;
      const mfgPart = product.manufacturerItemNumber || null;

      // Step 2: get full product detail
      const detailRes = await fetch(
        "/api/v1/products/" +
          productId +
          "?expand=documents,detail,htmlContent"
      );
      if (!detailRes.ok)
        return { productId, productUrl, mfgPart, upc: null, desc: null, sdsUrl: null };

      const detailData = await detailRes.json();
      const p = detailData.product;

      // Extract SDS document URL
      let sdsUrl: string | null = null;
      if (p.documents && p.documents.length) {
        const sds = p.documents.find(
          (d: any) =>
            d.name?.toLowerCase().includes("sds") ||
            d.filePath?.toLowerCase().includes("sds")
        );
        if (sds) sdsUrl = sds.filePath;
      }

      return {
        productId,
        productUrl,
        mfgPart: mfgPart || p.manufacturerItem || null,
        upc: p.upcCode || null,
        desc: p.htmlContent || p.erpDescription || null,
        sdsUrl,
      };
    }, sku);

    if (!result) return null;

    return {
      sku,
      description: result.desc
        ? String(result.desc).replace(/<[^>]*>/g, "").trim().substring(0, 2000)
        : null,
      upc: result.upc || null,
      mfgPart: result.mfgPart || null,
      sdsUrl: result.sdsUrl || null,
      productUrl: result.productUrl || null,
      productId: result.productId || null,
    };
  } catch {
    return null;
  }
}

// Phase 2: HTML page scrape for specifications
async function scrapeSpecs(
  page: Page,
  productUrl: string
): Promise<string | null> {
  try {
    await page.goto("https://www.pool360.com" + productUrl, {
      waitUntil: "domcontentloaded",
      timeout: 15000,
    });
    await randomDelay(2000, 3000);

    const specs = await page.evaluate(() => {
      const text = document.body.innerText;
      const specMatch = text.match(
        /Specifications\s*\nanchor\s*\n([\s\S]*?)(?=\n(?:Parts|Wholegoods|anchor)\s*\n)/i
      );
      if (!specMatch) return null;

      const lines = specMatch[1]
        .trim()
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l.length > 0);

      // Parse key-value pairs (they come as alternating lines: key, value, key, value)
      const pairs: string[] = [];
      for (let i = 0; i < lines.length - 1; i += 2) {
        const key = lines[i];
        const val = lines[i + 1];
        if (key && val && key !== val) {
          pairs.push(`${key}: ${val}`);
        }
      }

      return pairs.length > 0 ? pairs.join("\n") : null;
    });

    return specs;
  } catch {
    return null;
  }
}

async function main() {
  console.log(`[main] Pool360 Deep Scrape — ${new Date().toISOString()}`);

  const { PrismaClient } = require("@prisma/client");
  const prisma = new PrismaClient();

  // Get products that need enrichment (no UPC or no specs)
  const products = await prisma.poolProduct.findMany({
    where: {
      status: "active",
      OR: [{ upc: null }, { specs: null }],
    },
    select: { sku: true, name: true, brand: true, upc: true, specs: true },
    orderBy: { brand: "asc" },
  });

  console.log(`[main] ${products.length} products need enrichment`);

  if (products.length === 0) {
    await prisma.$disconnect();
    return;
  }

  const context = await chromium.launchPersistentContext(BROWSER_PROFILE_DIR, {
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    viewport: { width: 1920, height: 1080 },
  });
  const page = context.pages()[0] || (await context.newPage());

  // Navigate to pool360 to establish session for API calls
  await page.goto("https://www.pool360.com", { waitUntil: "domcontentloaded" });
  await randomDelay(3000, 4000);

  // Phase 1: API pass
  console.log("\n=== PHASE 1: API Data (UPC, Description, Mfg Part) ===\n");
  let apiUpdated = 0;
  let apiFailed = 0;
  const needsSpecs: { sku: string; productUrl: string }[] = [];

  for (let i = 0; i < products.length; i++) {
    const product = products[i];
    if (i > 0 && i % 50 === 0) {
      console.log(`[api] Progress: ${i}/${products.length} (updated: ${apiUpdated})`);
    }

    const data = await fetchProductAPI(page, product.sku);

    if (data && (data.upc || data.description || data.mfgPart)) {
      const updateData: any = {};
      if (data.upc && !product.upc) updateData.upc = data.upc;
      if (data.description) updateData.description = data.description;
      if (data.mfgPart) updateData.mfgPart = data.mfgPart;

      if (Object.keys(updateData).length > 0) {
        await prisma.poolProduct.update({
          where: { sku: product.sku },
          data: updateData,
        });
        apiUpdated++;
      }

      if (data.productUrl && !product.specs) {
        needsSpecs.push({ sku: product.sku, productUrl: data.productUrl });
      }
    } else {
      apiFailed++;
    }

    // Light rate limiting for API calls
    await randomDelay(300, 600);
  }

  console.log(
    `\n[api] Phase 1 done. Updated: ${apiUpdated}, Failed: ${apiFailed}`
  );

  // Phase 2: HTML scrape for specs
  if (!SKIP_SPECS && needsSpecs.length > 0) {
    console.log(
      `\n=== PHASE 2: HTML Scrape (Specifications) — ${needsSpecs.length} products ===\n`
    );
    let specsUpdated = 0;
    let specsFailed = 0;

    for (let i = 0; i < needsSpecs.length; i++) {
      const { sku, productUrl } = needsSpecs[i];
      if (i > 0 && i % 25 === 0) {
        console.log(
          `[specs] Progress: ${i}/${needsSpecs.length} (updated: ${specsUpdated})`
        );
      }

      const specs = await scrapeSpecs(page, productUrl);

      if (specs) {
        await prisma.poolProduct.update({
          where: { sku },
          data: { specs },
        });
        specsUpdated++;
      } else {
        specsFailed++;
      }

      await randomDelay(1500, 2500);
    }

    console.log(
      `\n[specs] Phase 2 done. Updated: ${specsUpdated}, Failed: ${specsFailed}`
    );
  }

  await context.close();

  // Print summary
  const withUpc = await prisma.poolProduct.count({
    where: { upc: { not: null } },
  });
  const withSpecs = await prisma.poolProduct.count({
    where: { specs: { not: null } },
  });
  const withDesc = await prisma.poolProduct.count({
    where: { description: { not: null } },
  });
  const total = await prisma.poolProduct.count();

  console.log("\n=== FINAL STATS ===");
  console.log(`Total products: ${total}`);
  console.log(`With UPC: ${withUpc}`);
  console.log(`With description: ${withDesc}`);
  console.log(`With specs: ${withSpecs}`);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("[main] Fatal:", err);
  process.exit(1);
});
