/**
 * Mirror Facebook Marketplace rental listing photos to /public/<slug>/fb/
 *
 * Usage:
 *   npx tsx scripts/mirror-fb-rentals.ts
 *   npx tsx scripts/mirror-fb-rentals.ts --dry-run
 *
 * Fetches each listing anonymously (mobile UA), extracts the listing carousel
 * photos (stops before "Today's picks" section), downloads them as JPEG/WebP,
 * and writes a manifest.json with fetch timestamps + canonical URLs.
 */

import { chromium } from "playwright";
import path from "path";
import fs from "fs";
import https from "https";
import http from "http";
import { URL } from "url";

const DRY_RUN = process.argv.includes("--dry-run");

// ── Listing manifest ─────────────────────────────────────────────────────────
const LISTINGS = [
  {
    slug: "kerplunk",
    fbItemId: "1384001560163054",
    publicDir: "kerplunk/fb",
    filePrefix: "kp",
  },
  {
    slug: "picnic-table",
    fbItemId: "896379263447778",
    publicDir: "picnic-table/fb",
    filePrefix: "pt",
  },
  {
    slug: "tables",
    fbItemId: "1128288392562563",
    publicDir: "tables/fb",
    filePrefix: "tbl",
  },
  {
    slug: "moving",
    fbItemId: "1443675080539245",
    publicDir: "moving/fb",
    filePrefix: "mv",
  },
  {
    slug: "trailer-20",
    fbItemId: "1944162059646045",
    publicDir: "trailer/20/fb",
    filePrefix: "t20",
  },
  {
    slug: "trailer-18",
    fbItemId: "1355273943436037",
    publicDir: "trailer/18/fb",
    filePrefix: "t18",
  },
];

const PUBLIC_DIR = path.resolve(process.cwd(), "public");
const UA =
  "Mozilla/5.0 (Linux; Android 13; SM-S908B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";

// ── Extract listing photos from mobile FB page ────────────────────────────────
async function extractListingPhotos(
  page: import("playwright").Page,
  fbItemId: string
): Promise<string[]> {
  const url = `https://m.facebook.com/marketplace/item/${fbItemId}/`;
  console.log(`  → navigating ${url}`);
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45_000 });
  await page.waitForTimeout(6_000);

  const rawPhotos: string[] = await page.evaluate(() => {
    const imgs: { src: string; w: number; h: number }[] = [];

    // Find "Today's picks" boundary — stop before the recommendations grid
    const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let picksNode: Element | null = null;
    let n;
    while ((n = tw.nextNode())) {
      if (n.textContent?.includes("Today's picks")) {
        picksNode = n.parentElement;
        break;
      }
    }

    for (const img of Array.from(document.querySelectorAll("img"))) {
      // Stop when we hit "Today's picks"
      if (
        picksNode &&
        img.compareDocumentPosition(picksNode) & Node.DOCUMENT_POSITION_PRECEDING
      ) {
        continue;
      }
      const src = img.src;
      if (!src.includes("fbcdn")) continue;
      if (src.includes("t1.30497")) continue; // profile avatar
      if (src.includes("rsrc.php")) continue; // UI sprite
      if (src.includes("static_map.php")) continue; // location map
      if (img.naturalWidth < 200) continue;
      imgs.push({ src, w: img.naturalWidth, h: img.naturalHeight });
    }

    // Deduplicate by base URL (strip signed query params)
    const seen = new Set<string>();
    const unique: string[] = [];
    for (const img of imgs) {
      const base = img.src.split("?")[0];
      if (!seen.has(base)) {
        seen.add(base);
        unique.push(img.src);
      }
    }
    return unique.slice(0, 12); // cap at 12 photos
  });

  return rawPhotos;
}

// ── Download a single URL to a file path ─────────────────────────────────────
async function downloadFile(url: string, destPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const proto = parsedUrl.protocol === "https:" ? https : http;
    const req = proto.get(
      url,
      {
        headers: {
          "User-Agent": UA,
          Referer: "https://m.facebook.com/",
          Accept: "image/webp,image/avif,image/*,*/*;q=0.8",
        },
      },
      (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          // Follow redirect
          downloadFile(res.headers.location, destPath).then(resolve).catch(reject);
          return;
        }
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode} for ${url}`));
          return;
        }
        const file = fs.createWriteStream(destPath);
        res.pipe(file);
        file.on("finish", () => {
          file.close();
          resolve();
        });
        file.on("error", reject);
      }
    );
    req.on("error", reject);
    req.setTimeout(20_000, () => {
      req.destroy();
      reject(new Error(`Timeout downloading ${url}`));
    });
  });
}

// ── Guess extension from fbcdn URL ───────────────────────────────────────────
function guessExt(url: string): string {
  if (url.includes("_n.webp") || url.includes("dst-webp")) return ".webp";
  if (url.includes("_n.png")) return ".png";
  return ".jpg";
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n🟢 FB Rental Mirror${DRY_RUN ? " [DRY RUN]" : ""}\n`);

  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  });
  const ctx = await browser.newContext({
    userAgent: UA,
    viewport: { width: 412, height: 915 },
    isMobile: true,
    locale: "en-US",
    deviceScaleFactor: 2,
  });
  const page = await ctx.newPage();

  const summary: Record<string, { photoCount: number; dir: string }> = {};

  for (const listing of LISTINGS) {
    console.log(`\n📦 ${listing.slug} (item ${listing.fbItemId})`);
    const outputDir = path.join(PUBLIC_DIR, listing.publicDir);

    try {
      const photos = await extractListingPhotos(page, listing.fbItemId);
      console.log(`  Found ${photos.length} listing photos`);

      if (photos.length === 0) {
        console.warn(`  ⚠️  No photos found — listing may be expired`);
        continue;
      }

      if (DRY_RUN) {
        photos.forEach((p, i) => console.log(`  [${i + 1}] ${p.slice(0, 120)}`));
        summary[listing.slug] = { photoCount: photos.length, dir: outputDir };
        continue;
      }

      fs.mkdirSync(outputDir, { recursive: true });

      const manifest: {
        fetchedAt: string;
        fbItemId: string;
        photos: { file: string; fbUrl: string }[];
      } = {
        fetchedAt: new Date().toISOString(),
        fbItemId: listing.fbItemId,
        photos: [],
      };

      for (let i = 0; i < photos.length; i++) {
        const rawUrl = photos[i];
        // Request a higher-res version by modifying the stp query
        const hiresUrl = rawUrl.replace(/p\d+x\d+/, "p1080x1080").replace(/ctp=\w+/, "ctp=p1080x1080");
        const ext = guessExt(rawUrl);
        const filename = `${listing.filePrefix}-${i + 1}${ext}`;
        const destPath = path.join(outputDir, filename);

        try {
          await downloadFile(hiresUrl, destPath);
          const stat = fs.statSync(destPath);
          console.log(`  ✓ ${filename}  (${Math.round(stat.size / 1024)}kb)`);
          manifest.photos.push({ file: `/${listing.publicDir}/${filename}`, fbUrl: rawUrl });
        } catch (err) {
          // Fallback to original URL
          try {
            await downloadFile(rawUrl, destPath);
            const stat = fs.statSync(destPath);
            console.log(`  ✓ ${filename} [fallback]  (${Math.round(stat.size / 1024)}kb)`);
            manifest.photos.push({ file: `/${listing.publicDir}/${filename}`, fbUrl: rawUrl });
          } catch (err2) {
            console.error(`  ✗ Failed to download photo ${i + 1}: ${err2}`);
          }
        }
      }

      const manifestPath = path.join(outputDir, "manifest.json");
      fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
      console.log(`  📄 manifest.json → ${manifest.photos.length} photos`);
      summary[listing.slug] = { photoCount: manifest.photos.length, dir: outputDir };
    } catch (err) {
      console.error(`  ✗ Error processing ${listing.slug}: ${err}`);
    }
  }

  await browser.close();

  console.log("\n📋 Summary:");
  for (const [slug, info] of Object.entries(summary)) {
    console.log(`  ${slug}: ${info.photoCount} photos → ${info.dir}`);
  }
  console.log(DRY_RUN ? "\n✅ Dry run complete — no files written." : "\n✅ Mirror complete.");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
