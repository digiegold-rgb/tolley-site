#!/usr/bin/env node
/**
 * sync-shorts-map.mjs — refresh lib/shop/shorts-map.json from the growth-engine
 * shorts ledger (posted.json). Maps ASIN -> latest successfully-posted YouTube
 * Short so /shop/[id] pages can embed the video. Run on the DGX (where
 * posted.json lives) before a deploy; daily-shorts-cron.sh also runs it after
 * each post so the next deploy always ships a current map.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const POSTED = "/home/jelly/growth-engine/shorts/posted.json";
const OUT = path.join(__dirname, "..", "lib", "shop", "shorts-map.json");

// v1 videos Jared ordered taken down 7/11 — never embed even if still public
const SKIP = new Set(["6tPWHdq-68I", "SslDmZfkR0M"]);

const entries = JSON.parse(fs.readFileSync(POSTED, "utf8")).entries || [];
const map = {};
for (const e of entries) {
  const yt = e.platforms?.yt;
  const m = /youtu\.be\/([\w-]+)/.exec(yt?.url || "");
  if (!(yt?.ok && m && e.asin) || SKIP.has(m[1])) continue;
  // entries are chronological — later posts for the same ASIN overwrite
  map[e.asin] = { v: m[1], title: e.title, at: (e.renderedAt || "").slice(0, 10) };
}
fs.writeFileSync(OUT, JSON.stringify(map, null, 1) + "\n");
console.log(`shorts-map: ${Object.keys(map).length} ASINs -> ${OUT}`);
