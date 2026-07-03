/**
 * Render FB-ready assets from the chosen mascot (v4) for Ruthann's Treasure Haul:
 *  - mascot.png       (1024x1024, transparent — canonical sticker)
 *  - profile.png      (1024x1024 — solid dark-purple bg, mascot centered, FB profile)
 *  - cover.png        (1640x856 — wide banner, mascot left, wordmark + tagline right)
 *  - og-card.png      (1200x630 — FB link preview)
 *
 * Run: npx tsx scripts/render-treasure-haul-assets.ts
 */
import sharp from "sharp";
import path from "path";
import { copyFileSync } from "fs";

const DIR = path.join(__dirname, "..", "public", "branding", "ruthanns-treasure-haul");
const MASTER = path.join(DIR, "mascot-v4.png");
const MASCOT = path.join(DIR, "mascot.png");

const PURPLE_DEEP_RGB = { r: 26, g: 10, b: 46, alpha: 1 };
const PURPLE_BG = "#2a1450";
const PURPLE_PRIMARY = "#7c3aed";
const PURPLE_LIGHT = "#a78bfa";
const AMBER = "#FFB13A";

async function main() {
  // 1. Canonical master
  copyFileSync(MASTER, MASCOT);
  console.log("✓ mascot.png");

  // 2. Profile picture — 1024x1024, dark purple, mascot centered
  const dotGrid = `
    <svg width="1024" height="1024" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">
      ${Array.from({ length: 22 })
        .map((_, y) =>
          Array.from({ length: 22 })
            .map(
              (_, x) =>
                `<circle cx="${24 + x * 46}" cy="${24 + y * 46}" r="1.4" fill="${PURPLE_LIGHT}" opacity="0.18"/>`,
            )
            .join(""),
        )
        .join("")}
      <!-- corner glow -->
      <circle cx="512" cy="500" r="380" fill="${PURPLE_PRIMARY}" opacity="0.25"/>
    </svg>`;

  const mascotResized = await sharp(MASCOT)
    .resize({ width: 880, height: 880, fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();

  await sharp({
    create: {
      width: 1024,
      height: 1024,
      channels: 4,
      background: PURPLE_DEEP_RGB,
    },
  })
    .composite([
      { input: Buffer.from(dotGrid), top: 0, left: 0 },
      { input: mascotResized, gravity: "center" },
    ])
    .png()
    .toFile(path.join(DIR, "profile.png"));
  console.log("✓ profile.png 1024x1024");

  // 3. Cover photo — 1640x856 — banner with wordmark + tagline + url
  // Layout: mascot 0-720px (left), text 760-1620px (right)
  const coverTextSvg = `
    <svg width="1640" height="856" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1640 856">
      ${Array.from({ length: 35 })
        .map((_, y) =>
          Array.from({ length: 65 })
            .map(
              (_, x) =>
                `<circle cx="${24 + x * 25}" cy="${24 + y * 25}" r="0.9" fill="${PURPLE_LIGHT}" opacity="0.10"/>`,
            )
            .join(""),
        )
        .join("")}

      <!-- Wordmark -->
      <text x="780" y="290" font-family="Sora, Helvetica, Arial, sans-serif" font-size="80" font-weight="800" fill="white" letter-spacing="-2">Ruthann's</text>
      <text x="780" y="400" font-family="Sora, Helvetica, Arial, sans-serif" font-size="118" font-weight="900" fill="${AMBER}" letter-spacing="-3">Treasure Haul</text>

      <!-- Tagline -->
      <text x="780" y="475" font-family="Sora, Helvetica, Arial, sans-serif" font-size="34" font-weight="500" fill="${PURPLE_LIGHT}">New finds daily · Kansas City pickup</text>

      <!-- URL -->
      <text x="780" y="600" font-family="Sora, Helvetica, Arial, sans-serif" font-size="48" font-weight="700" fill="white">tolley.io/shop</text>
      <line x1="780" y1="620" x2="1340" y2="620" stroke="${AMBER}" stroke-width="6" stroke-linecap="round"/>

      <!-- DM CTA -->
      <text x="780" y="700" font-family="Sora, Helvetica, Arial, sans-serif" font-size="28" font-weight="500" fill="${PURPLE_LIGHT}" opacity="0.85">DM to claim · KC metro pickup</text>

      <!-- decorative magnifier (top right) -->
      <g transform="translate(1480, 90)" opacity="0.20">
        <circle cx="40" cy="40" r="38" fill="none" stroke="${PURPLE_LIGHT}" stroke-width="6"/>
        <line x1="68" y1="68" x2="92" y2="92" stroke="${PURPLE_LIGHT}" stroke-width="8" stroke-linecap="round"/>
      </g>
    </svg>`;

  const mascotForCover = await sharp(MASCOT)
    .resize({ width: 720, height: 720, fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();

  await sharp({
    create: {
      width: 1640,
      height: 856,
      channels: 4,
      background: PURPLE_DEEP_RGB,
    },
  })
    .composite([
      { input: Buffer.from(coverTextSvg), top: 0, left: 0 },
      { input: mascotForCover, top: 70, left: 40 },
    ])
    .png()
    .toFile(path.join(DIR, "cover.png"));
  console.log("✓ cover.png 1640x856");

  // 4. OG card — 1200x630
  const ogTextSvg = `
    <svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630">
      <text x="540" y="220" font-family="Sora, Helvetica, Arial, sans-serif" font-size="58" font-weight="800" fill="white">Ruthann's</text>
      <text x="540" y="305" font-family="Sora, Helvetica, Arial, sans-serif" font-size="82" font-weight="900" fill="${AMBER}">Treasure Haul</text>
      <text x="540" y="365" font-family="Sora, Helvetica, Arial, sans-serif" font-size="26" font-weight="500" fill="${PURPLE_LIGHT}">New finds daily · KC pickup</text>
      <text x="540" y="475" font-family="Sora, Helvetica, Arial, sans-serif" font-size="38" font-weight="700" fill="white">tolley.io/shop</text>
      <line x1="540" y1="490" x2="900" y2="490" stroke="${AMBER}" stroke-width="4" stroke-linecap="round"/>
    </svg>`;

  const mascotForOg = await sharp(MASCOT)
    .resize({ width: 500, height: 500, fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();

  await sharp({
    create: {
      width: 1200,
      height: 630,
      channels: 4,
      background: PURPLE_DEEP_RGB,
    },
  })
    .composite([
      { input: Buffer.from(ogTextSvg), top: 0, left: 0 },
      { input: mascotForOg, top: 65, left: 30 },
    ])
    .png()
    .toFile(path.join(DIR, "og-card.png"));
  console.log("✓ og-card.png 1200x630");

  console.log("\nAll assets in:", DIR);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
