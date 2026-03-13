/**
 * Pool360 Price/Stock Scraper
 *
 * Logs into pool360.com, scrapes product data from category pages,
 * and POSTs the results to the tolley.io sync endpoint.
 *
 * Usage:
 *   npx tsx scripts/pool360-sync.ts          # normal sync (headless, needs prior login)
 *   npx tsx scripts/pool360-sync.ts --login   # interactive login (opens browser window)
 *
 * Env vars:
 *   SYNC_URL     — override sync endpoint (default: https://www.tolley.io/api/pools/sync)
 *   SYNC_SECRET  — bearer token for sync endpoint (required for sync)
 */

import { chromium, type Page } from "playwright";
import path from "path";

// ── Config ──────────────────────────────────────────────────────────────────

const POOL360_BASE = "https://www.pool360.com";

const CATEGORY_PATHS = [
  // Chemicals
  "/Catalog/pool-and-spa-products/pool-spa-chemicals/sanitizers/chlorine-sanitizers",
  "/Catalog/pool-and-spa-products/pool-spa-chemicals/shock/chlorine-shock",
  "/Catalog/pool-and-spa-products/pool-spa-chemicals/water-balancers/ph-increasers",
  "/Catalog/pool-and-spa-products/pool-spa-chemicals/water-balancers/ph-decreasers",
  "/Catalog/pool-and-spa-products/pool-spa-chemicals/algaecides/shop-all-algaecides",
  // Equipment
  "/Catalog/pool-and-spa-products/pool-spa-equipment/pool-pumps/pumps",
  "/Catalog/pool-and-spa-products/pool-spa-equipment/pool-filters/filters",
  "/Catalog/pool-and-spa-products/pool-spa-equipment/pool-spa-sanitizing-systems/salt-generators-cells",
  "/Catalog/pool-and-spa-products/pool-spa-equipment/pool-heating-cooling/heaters",
  // Maintenance
  "/Catalog/pool-and-spa-products/maintenance-cleaning/cleaning-tools/brushes",
  "/Catalog/pool-and-spa-products/maintenance-cleaning/cleaning-tools/skimmer-nets-leaf-rakes",
  "/Catalog/pool-and-spa-products/maintenance-cleaning/cleaning-tools/poles",
  "/Catalog/pool-and-spa-products/maintenance-cleaning/cleaning-tools/vacuums-heads",
  "/Catalog/pool-and-spa-products/maintenance-cleaning/cleaning-tools/pool-hoses",
  "/Catalog/pool-and-spa-products/maintenance-cleaning/water-testing-control/test-kits-strips",
];

const MAX_LOAD_MORE = 20;

const BROWSER_PROFILE_DIR = path.join(
  process.env.HOME || "/home/jelly",
  ".pool360-profile"
);

const SYNC_URL =
  process.env.SYNC_URL || "https://www.tolley.io/api/pools/sync";
const SYNC_SECRET = process.env.SYNC_SECRET;

const LOGIN_MODE = process.argv.includes("--login");

interface ScrapedProduct {
  sku: string;
  name: string;
  brand: string;
  price: number;
  stockQty?: number;
  mfgPart?: string;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function randomDelay(minMs: number, maxMs: number): Promise<void> {
  const ms = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  return new Promise((r) => setTimeout(r, ms));
}

// ── Auth Check ──────────────────────────────────────────────────────────────

async function isAuthenticated(page: Page): Promise<boolean> {
  try {
    const resp = await page.evaluate(() =>
      fetch("/api/v1/sessions/current")
        .then((r) => r.json())
        .then((j) => j.isAuthenticated === true)
        .catch(() => false)
    );
    return resp;
  } catch {
    return false;
  }
}

// ── Interactive Login (--login mode) ────────────────────────────────────────

async function interactiveLogin(page: Page): Promise<void> {
  console.log("[login] Opening pool360.com for interactive login...");
  console.log("[login] Complete the Azure B2C sign-in in the browser window.");
  console.log("[login] The script will continue automatically once authenticated.\n");

  await page.goto(POOL360_BASE, { waitUntil: "domcontentloaded" });
  await randomDelay(2000, 3000);

  // Click account icon → Sign In / Register to start the flow
  await page.evaluate(() => {
    const navs = document.querySelectorAll("nav");
    for (const nav of navs) {
      const btn = nav.querySelector("button");
      if (btn) {
        (btn as HTMLElement).click();
        return;
      }
    }
  });
  await randomDelay(1000, 2000);

  const signInBtn = page
    .locator('button:has-text("Sign In"), a:has-text("Sign In")')
    .first();
  if (await signInBtn.isVisible().catch(() => false)) {
    await signInBtn.click();
  }

  // Poll until authenticated (user completes B2C login in the browser window)
  console.log("[login] Waiting for authentication...");
  for (let i = 0; i < 120; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    if (await isAuthenticated(page)) {
      console.log("[login] Authenticated successfully!");

      // Handle ChangeAccount page
      if (page.url().includes("ChangeAccount")) {
        console.log("[login] Clicking Continue on account selection...");
        try {
          const continueBtn = page.locator('button:has-text("Continue")');
          await continueBtn.waitFor({ timeout: 5000 });
          await continueBtn.click();
          await randomDelay(2000, 3000);
        } catch {
          // ok
        }
      }

      // Handle delivery modal
      try {
        const dontShowBtn = page.locator('text="Don\'t show anymore"');
        await dontShowBtn.waitFor({ timeout: 5000 });
        await dontShowBtn.click();
        await randomDelay(1000, 2000);
      } catch {
        // ok
      }

      console.log("[login] Session saved to persistent profile.");
      console.log("[login] Future headless runs will use this session.");
      return;
    }
  }

  console.error("[login] Timed out waiting for authentication (4 minutes).");
  process.exit(1);
}

// ── Scrape Category ─────────────────────────────────────────────────────────

async function scrapeCategory(
  page: Page,
  categoryPath: string
): Promise<ScrapedProduct[]> {
  const url = `${POOL360_BASE}${categoryPath}`;
  console.log(`[scrape] Navigating to ${url}`);
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await randomDelay(2000, 3000);

  // Click "Load More" until all products are visible
  let loadMoreClicks = 0;
  while (loadMoreClicks < MAX_LOAD_MORE) {
    try {
      const loadMoreBtn = page.locator(
        'button:has-text("Load More"), a:has-text("Load More")'
      );
      const visible = await loadMoreBtn.isVisible({ timeout: 2000 });
      if (!visible) break;
      await loadMoreBtn.click();
      loadMoreClicks++;
      console.log(`[scrape] Clicked Load More (#${loadMoreClicks})`);
      await randomDelay(2000, 4000);
    } catch {
      break;
    }
  }
  if (loadMoreClicks >= MAX_LOAD_MORE) {
    console.warn(
      `[scrape] Hit MAX_LOAD_MORE cap (${MAX_LOAD_MORE}) on ${categoryPath} — results may be truncated`
    );
  }

  // Extract product data from the page
  const products = await page.evaluate(() => {
    const results: {
      sku: string;
      name: string;
      brand: string;
      price: number;
      stockQty?: number;
      mfgPart?: string;
    }[] = [];

    // Pool360 page format (innerText):
    // BRAND\nProduct Name\nProduct #:SKU-XX-XXXX\nMfg. Part #:XXXXX\n$XX.XX\n...(XX in stock)...
    const bodyText = document.body.innerText;
    const regex =
      /([A-Z][A-Z &\-']+)\n([^\n]+)\nProduct #:([A-Z0-9\-]+)\nMfg\. Part #:([^\n]+)\n\$([\d,]+\.\d{2})/g;
    let match;
    while ((match = regex.exec(bodyText)) !== null) {
      const afterMatch = bodyText.substring(match.index, match.index + 500);
      const stockMatch = afterMatch.match(/\((\d+)\s+in stock\)/);
      const price = parseFloat(match[5].replace(",", ""));
      if (isNaN(price) || price <= 0) continue;

      results.push({
        sku: match[3].trim(),
        name: match[2].trim(),
        brand: match[1].trim(),
        price,
        stockQty: stockMatch ? parseInt(stockMatch[1], 10) : undefined,
        mfgPart: match[4].trim(),
      });
    }

    return results;
  });

  console.log(
    `[scrape] Found ${products.length} products in ${categoryPath.split("/").pop()}`
  );
  return products;
}

// ── Sync to API ─────────────────────────────────────────────────────────────

async function syncToApi(products: ScrapedProduct[]): Promise<void> {
  if (!SYNC_SECRET) {
    console.error("[sync] SYNC_SECRET env var is required");
    process.exit(1);
  }

  console.log(`[sync] Sending ${products.length} products to ${SYNC_URL}`);

  const res = await fetch(SYNC_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SYNC_SECRET}`,
    },
    body: JSON.stringify({ products }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error(`[sync] HTTP ${res.status}: ${text}`);
    process.exit(1);
  }

  const result = await res.json();
  console.log("[sync] Result:", JSON.stringify(result, null, 2));
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`[main] Pool360 Sync — ${new Date().toISOString()}`);
  if (LOGIN_MODE) console.log("[main] Mode: interactive login");

  console.log(`[main] Browser profile: ${BROWSER_PROFILE_DIR}`);
  const context = await chromium.launchPersistentContext(BROWSER_PROFILE_DIR, {
    headless: !LOGIN_MODE,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    viewport: { width: 1920, height: 1080 },
  });
  const page = context.pages()[0] || (await context.newPage());

  try {
    if (LOGIN_MODE) {
      // Interactive login — opens browser, user completes B2C auth
      await interactiveLogin(page);
      console.log("[main] Login complete. Run without --login to sync.");
      return;
    }

    // Normal headless sync — check auth from persistent profile
    await page.goto(POOL360_BASE, { waitUntil: "domcontentloaded" });
    await randomDelay(3000, 5000);

    if (!(await isAuthenticated(page))) {
      console.error(
        "[main] Not authenticated. Run with --login first:\n" +
          "  DISPLAY=:0 npx tsx scripts/pool360-sync.ts --login"
      );
      process.exit(1);
    }
    console.log("[login] Authenticated via persistent profile.");

    const allProducts: ScrapedProduct[] = [];

    for (const categoryPath of CATEGORY_PATHS) {
      const products = await scrapeCategory(page, categoryPath);
      allProducts.push(...products);
      await randomDelay(2000, 5000);
    }

    // Deduplicate by SKU (keep last seen = freshest price)
    const skuMap = new Map<string, ScrapedProduct>();
    for (const p of allProducts) {
      skuMap.set(p.sku, p);
    }
    const unique = Array.from(skuMap.values());

    console.log(
      `[main] Total: ${allProducts.length} scraped, ${unique.length} unique SKUs`
    );

    if (unique.length === 0) {
      console.warn("[main] No products scraped — skipping sync.");
    } else {
      await syncToApi(unique);
    }
  } finally {
    await context.close();
  }

  console.log("[main] Done.");
}

main().catch((err) => {
  console.error("[main] Fatal:", err);
  process.exit(1);
});
