#!/usr/bin/env node
/* Renders the Jelly Studio brand-kit PNGs from the HTML files in this folder
 * using the repo's own Playwright chromium. Exact pixel sizes, deviceScaleFactor 1.
 *
 *   node scripts/briefs/brand/render.mjs [name ...]     # default: all
 */
import { chromium } from "playwright-core";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(HERE, "../../../public/animate/brand");

/* name, source html, viewport, and whether the plate is transparent */
const JOBS = [
  { out: "logo-1024.png", html: "logo.html", w: 1024, h: 1024 },
  { out: "logo-512.png", html: "logo.html", w: 512, h: 512 },
  { out: "logo-mark-transparent.png", html: "logo.html", w: 1024, h: 1024, bare: true },
  { out: "cover-1640x624.png", html: "cover.html", w: 1640, h: 624 },
  { out: "cover-mobile-820x360.png", html: "cover-mobile.html", w: 820, h: 360 },
  { out: "post-1-what-it-is.png", html: "post-1.html", w: 1080, h: 1080 },
  { out: "post-2-pricing.png", html: "post-2.html", w: 1080, h: 1080 },
  { out: "post-3-anti-slop.png", html: "post-3.html", w: 1080, h: 1080 },
  { out: "post-4-invite.png", html: "post-4.html", w: 1080, h: 1080 },
  { out: "endcard-1280x720.png", html: "endcard.html", w: 1280, h: 720, bare: true },
  { out: "endcard-1080x1920.png", html: "endcard-vertical.html", w: 1080, h: 1920, bare: true },
  { out: "reels-frame-1080x1920.png", html: "reels-frame.html", w: 1080, h: 1920, bare: true },
];

const only = process.argv.slice(2);
const jobs = only.length ? JOBS.filter((j) => only.some((o) => j.out.includes(o) || j.html.includes(o))) : JOBS;

fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ args: ["--font-render-hinting=none", "--force-color-profile=srgb"] });

for (const job of jobs) {
  const page = await browser.newPage({
    viewport: { width: job.w, height: job.h },
    deviceScaleFactor: 1,
  });
  await page.goto("file://" + path.join(HERE, job.html), { waitUntil: "networkidle" });
  if (job.bare) {
    await page.evaluate(() => {
      document.documentElement.classList.add("bare");
      document.body.classList.add("bare");
    });
  }
  // webfonts must be resolved before the shutter, or we screenshot the fallback
  await page.evaluate(() => document.fonts.ready);
  const loaded = await page.evaluate(() =>
    [
      ["Bricolage Grotesque", "700 16px"],
      ["Instrument Serif", "italic 16px"],
      ["JetBrains Mono", "600 16px"],
    ].map(([f, spec]) => `${f.split(" ")[0]}:${document.fonts.check(`${spec} "${f}"`) ? "ok" : "MISSING"}`),
  );
  await page.waitForTimeout(220);
  await page.screenshot({
    path: path.join(OUT, job.out),
    type: "png",
    omitBackground: !!job.bare,
    clip: { x: 0, y: 0, width: job.w, height: job.h },
  });
  await page.close();
  console.log(`${job.out}  ${job.w}x${job.h}  [${loaded.join(" ")}]`);
}

await browser.close();
