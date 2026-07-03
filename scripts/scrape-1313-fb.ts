/**
 * Scrape the 13:13 Weddings & Events Facebook page for real photos.
 *
 * Strategy:
 *   1. Try anonymous mobile FB first (m.facebook.com/1313weddingco).
 *   2. If blocked, fall back to logged-in via persistent profile ~/.fb-draft-profile.
 *   3. Download each photo's highest-res variant, save as WebP triplets,
 *      emit manifest with caption-derived alts.
 *
 * Usage:
 *   npx tsx scripts/scrape-1313-fb.ts
 */

import { chromium, type Page } from "playwright";
import path from "path";
import fs from "fs";
import https from "https";
import sharp from "sharp";
import os from "os";

const PAGE_USERNAME = "1313weddingco";
const PUBLIC_DIR = path.resolve(process.cwd(), "public", "e-and-t", "photos", "fb");
const PROFILE_DIR = path.join(os.homedir(), ".fb-draft-profile");
const SCAN_LIMIT = 80; // hard cap on photos
const SCROLL_STEPS = 12;

const UA_DESKTOP =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

fs.mkdirSync(PUBLIC_DIR, { recursive: true });

function download(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https
      .get(url, { headers: { "User-Agent": UA_DESKTOP } }, (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          file.close();
          fs.unlinkSync(dest);
          return download(res.headers.location, dest).then(resolve, reject);
        }
        if (res.statusCode !== 200) {
          file.close();
          fs.unlinkSync(dest);
          return reject(new Error(`HTTP ${res.statusCode}`));
        }
        res.pipe(file);
        file.on("finish", () => file.close(() => resolve()));
      })
      .on("error", (err) => {
        file.close();
        if (fs.existsSync(dest)) fs.unlinkSync(dest);
        reject(err);
      });
  });
}

async function collectPhotosFromPage(page: Page): Promise<{ src: string; alt: string }[]> {
  // Scroll a few times to load lazy images
  for (let i = 0; i < SCROLL_STEPS; i++) {
    await page.evaluate(() => window.scrollBy(0, window.innerHeight * 0.95));
    await page.waitForTimeout(900);
  }

  const photos = await page.evaluate(() => {
    const seen = new Set<string>();
    const out: { src: string; alt: string }[] = [];
    document.querySelectorAll("img").forEach((img) => {
      const src = img.currentSrc || img.src;
      if (!src) return;
      // Filter for FB CDN images (skip emoji, profile thumbs are still kept if big enough)
      if (!/scontent/.test(src)) return;
      const w = (img as HTMLImageElement).naturalWidth || img.width;
      const h = (img as HTMLImageElement).naturalHeight || img.height;
      if (w < 240 || h < 240) return;
      if (seen.has(src)) return;
      seen.add(src);
      out.push({ src, alt: (img.alt || "").trim() });
    });
    return out;
  });

  return photos;
}

async function tryAnonymous(): Promise<{ src: string; alt: string }[]> {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    userAgent: UA_DESKTOP,
    viewport: { width: 1280, height: 900 },
  });
  const page = await ctx.newPage();

  try {
    console.log("[anon] navigating to facebook.com/" + PAGE_USERNAME);
    await page.goto(`https://www.facebook.com/${PAGE_USERNAME}/photos`, {
      waitUntil: "domcontentloaded",
      timeout: 45_000,
    });
    await page.waitForTimeout(3000);

    // Dismiss cookie / login banners if present
    try {
      await page.click('[data-cookiebanner="accept_only_essential_button"]', { timeout: 2000 });
    } catch {}
    try {
      await page.click('div[role="button"][aria-label*="Close"]', { timeout: 2000 });
    } catch {}

    const photos = await collectPhotosFromPage(page);
    console.log(`[anon] collected ${photos.length} candidate photo URLs`);
    return photos;
  } finally {
    await browser.close();
  }
}

async function tryLoggedIn(): Promise<{ src: string; alt: string }[]> {
  if (!fs.existsSync(PROFILE_DIR)) {
    console.log("[auth] no persistent profile, skipping");
    return [];
  }
  console.log("[auth] launching with persistent profile");
  const ctx = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless: true,
    userAgent: UA_DESKTOP,
    viewport: { width: 1280, height: 900 },
  });
  const page = await ctx.newPage();
  try {
    await page.goto(`https://www.facebook.com/${PAGE_USERNAME}/photos`, {
      waitUntil: "domcontentloaded",
      timeout: 45_000,
    });
    await page.waitForTimeout(3500);

    if (/login|reg/.test(page.url())) {
      console.log("[auth] redirected to login — session expired");
      return [];
    }

    const photos = await collectPhotosFromPage(page);
    console.log(`[auth] collected ${photos.length} candidate photo URLs`);
    return photos;
  } finally {
    await ctx.close();
  }
}

function classify(alt: string, idx: number): { slug: string; alt: string } {
  const lower = alt.toLowerCase();
  if (/officiant|ceremony|altar|vows/.test(lower))
    return { slug: `ceremony-${idx}`, alt: alt || "13:13 Weddings & Events — ceremony moment" };
  if (/bouquet|flower|floral|arrangement/.test(lower))
    return { slug: `florals-${idx}`, alt: alt || "Florals styled by 13:13 Weddings & Events" };
  if (/bride|couple|groom|emily|trevor|portrait/.test(lower))
    return { slug: `couple-${idx}`, alt: alt || "Couple portrait from a 13:13 event" };
  if (/reception|table|dance|cake/.test(lower))
    return { slug: `reception-${idx}`, alt: alt || "Reception moment from a 13:13 event" };
  return { slug: `photo-${idx}`, alt: alt || "13:13 Weddings & Events moment" };
}

async function main() {
  let raw: { src: string; alt: string }[] = [];
  try {
    raw = await tryAnonymous();
  } catch (err) {
    console.error("[anon] failed:", (err as Error).message);
  }
  if (raw.length < 4) {
    try {
      const auth = await tryLoggedIn();
      // Merge & dedupe
      const seen = new Set(raw.map((p) => p.src));
      for (const p of auth) {
        if (!seen.has(p.src)) {
          raw.push(p);
          seen.add(p.src);
        }
      }
    } catch (err) {
      console.error("[auth] failed:", (err as Error).message);
    }
  }

  console.log(`Total unique photo candidates: ${raw.length}`);
  if (raw.length === 0) {
    console.error("No photos found. Exiting non-fatally so brochure fallback can fill.");
    fs.writeFileSync(
      path.join(PUBLIC_DIR, "manifest.json"),
      JSON.stringify({ photos: [], scrapedAt: new Date().toISOString(), note: "no photos accessible" }, null, 2),
    );
    return;
  }

  // Filter & limit
  raw = raw.slice(0, SCAN_LIMIT);

  // Try to upgrade FB CDN URLs to higher resolution by removing _n.jpg size hints
  // FB photo URLs sometimes have stp=dst-jpg_p180x540 or _s960x960 — strip those.
  raw = raw.map((p) => ({
    src: p.src.replace(/&_nc_cat=\d+/, "").replace(/stp=[^&]+&?/, ""),
    alt: p.alt,
  }));

  const manifest: { id: string; webp1600: string; webp2400: string; alt: string; sourceUrl: string; w: number; h: number }[] = [];

  for (let i = 0; i < raw.length; i++) {
    const { src, alt } = raw[i];
    const { slug, alt: cleanAlt } = classify(alt, i + 1);
    const id = slug;
    const tmpPath = path.join(PUBLIC_DIR, `${id}.tmp`);
    try {
      await download(src, tmpPath);
      const meta = await sharp(tmpPath).metadata();
      if (!meta.width || meta.width < 600) {
        console.log(`  skip ${id} (too small: ${meta.width}x${meta.height})`);
        fs.unlinkSync(tmpPath);
        continue;
      }
      for (const w of [800, 1600, 2400]) {
        const dest = path.join(PUBLIC_DIR, `${id}-${w}.webp`);
        await sharp(tmpPath)
          .resize(w, null, { withoutEnlargement: true })
          .webp({ quality: 82 })
          .toFile(dest);
      }
      fs.unlinkSync(tmpPath);
      manifest.push({
        id,
        webp1600: `/e-and-t/photos/fb/${id}-1600.webp`,
        webp2400: `/e-and-t/photos/fb/${id}-2400.webp`,
        alt: cleanAlt,
        sourceUrl: src,
        w: meta.width || 0,
        h: meta.height || 0,
      });
      console.log(`  ✓ ${id} (${meta.width}x${meta.height})`);
    } catch (err) {
      console.error(`  ✗ ${id}:`, (err as Error).message);
      if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
    }
  }

  fs.writeFileSync(
    path.join(PUBLIC_DIR, "manifest.json"),
    JSON.stringify({ photos: manifest, scrapedAt: new Date().toISOString() }, null, 2),
  );
  console.log(`Saved ${manifest.length} photos. Manifest at ${path.join(PUBLIC_DIR, "manifest.json")}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
