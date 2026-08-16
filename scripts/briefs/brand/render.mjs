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
  /* logo family — `variant` becomes a body class so one source serves all */
  { out: "logo-1024.png", html: "logo.html", w: 1024, h: 1024 },
  { out: "logo-512.png", html: "logo.html", w: 512, h: 512 },
  { out: "logo-compact-512.png", html: "logo.html", w: 512, h: 512, variant: "compact" },
  { out: "favicon-512.png", html: "logo.html", w: 512, h: 512, variant: "compact" },
  { out: "logo-reversed-1024.png", html: "logo.html", w: 1024, h: 1024, variant: "reversed" },
  { out: "logo-mono-black.png", html: "logo.html", w: 1024, h: 1024, variant: "mono-black", bare: true },
  { out: "logo-mono-white.png", html: "logo.html", w: 1024, h: 1024, variant: "mono-white", bare: true },

  { out: "logo-lockup-1600x400.png", html: "lockup.html", w: 1600, h: 400 },
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
  if (job.variant) {
    await page.evaluate((v) => {
      document.body.classList.add(v);
      // `compact` and `reversed` are modifiers on the mark itself
      for (const m of document.querySelectorAll(".jmark")) m.classList.add(v);
    }, job.variant);
  }
  // webfonts must be resolved before the shutter, or we screenshot the fallback
  await page.evaluate(() => document.fonts.ready);
  const loaded = await page.evaluate(() =>
    [
      ["Space Grotesk", "700 16px"],
      ["IBM Plex Mono", "400 16px"],
    ].map(([f, spec]) => {
      // check() answers "can this render with what's loaded", which is trivially
      // true for a family the page never requested — so also confirm a matching
      // FontFace actually exists in the document's set.
      const known = [...document.fonts].some((ff) => ff.family.replace(/["']/g, "") === f);
      return `${f.split(" ")[0]}:${known && document.fonts.check(`${spec} "${f}"`) ? "ok" : "MISSING"}`;
    }),
  );
  await page.waitForTimeout(220);
  const dest = job.scratch ? path.join(HERE, job.out) : path.join(OUT, job.out);
  await page.screenshot({
    path: dest,
    type: "png",
    omitBackground: !!job.bare,
    clip: { x: 0, y: 0, width: job.w, height: job.h },
  });
  await page.close();
  console.log(`${job.out}  ${job.w}x${job.h}  [${loaded.join(" ")}]`);
}

await browser.close();
