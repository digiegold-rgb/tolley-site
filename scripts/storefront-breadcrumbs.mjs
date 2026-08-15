/**
 * Fetch the real Amazon browse category for every live-verified storefront
 * ASIN, so shelves can be assigned from Amazon's own taxonomy instead of
 * title keywords (which filed a hair dryer under Home & Lighting because its
 * title said "Lightweight").
 *
 * Two signals per detail page, in preference order:
 *   1. the wayfinding breadcrumb ladder ("Beauty & Personal Care › Hair Care › …")
 *   2. the Best Sellers Rank category ("#4 in Beauty & Personal Care")
 * Either one pins the root department; pages missing both stay uncategorized
 * and land in the Needs-review bucket downstream.
 *
 * Usage: node scripts/storefront-breadcrumbs.mjs [--in DIR] [--concurrency 2] [--delay 900]
 */
import { readFileSync, appendFileSync, existsSync } from "node:fs";

const args = process.argv.slice(2);
const argVal = (f, d) => (args.indexOf(f) === -1 ? d : args[args.indexOf(f) + 1]);
const DIR = argVal("--in", "/home/jelly/Shared/amazon-push/storefront");
const CONCURRENCY = Number(argVal("--concurrency", 2));
const DELAY_MS = Number(argVal("--delay", 900));
const CKPT = `${DIR}/breadcrumbs.jsonl`;

const HEADERS = {
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36",
  accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "accept-language": "en-US,en;q=0.9",
  "sec-ch-ua": '"Chromium";v="127", "Not)A;Brand";v="99"',
  "sec-ch-ua-mobile": "?0",
  "sec-ch-ua-platform": '"Windows"',
  "sec-fetch-dest": "document",
  "sec-fetch-mode": "navigate",
  "sec-fetch-site": "none",
  "upgrade-insecure-requests": "1",
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const decode = (s) =>
  s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();

function parseBreadcrumbs(html) {
  const block = html.match(
    /id="wayfinding-breadcrumbs_feature_div"[\s\S]*?<\/ul>/i
  )?.[0];
  if (!block) return null;
  const crumbs = [...block.matchAll(/<a[^>]*>([\s\S]*?)<\/a>/gi)]
    .map((m) => decode(m[1].replace(/<[^>]+>/g, "")))
    .filter(Boolean);
  return crumbs.length ? crumbs : null;
}

function parseBsrRoot(html) {
  // "#4,321 in Beauty & Personal Care (" — the unparenthesized rank is the root.
  const m = html.match(/#[\d,]+\s+in\s+([^(<\n]+?)\s*\(/);
  return m ? decode(m[1]) : null;
}

async function fetchCategory(asin, attempt = 0) {
  try {
    const res = await fetch(`https://www.amazon.com/dp/${asin}`, {
      headers: HEADERS,
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) {
      if ((res.status === 503 || res.status === 429) && attempt < 3) {
        await sleep(4000 * (attempt + 1));
        return fetchCategory(asin, attempt + 1);
      }
      return { ok: false, reason: `http_${res.status}` };
    }
    const html = await res.text();
    if (/Enter the characters you see below/i.test(html)) {
      if (attempt < 3) {
        await sleep(6000 * (attempt + 1));
        return fetchCategory(asin, attempt + 1);
      }
      return { ok: false, reason: "captcha" };
    }
    // Soft block: a ~4KB "To discuss automated access…" shell with a 200
    // status. It carries no product data, so it is a throttle verdict on us,
    // never a category verdict on the ASIN.
    if (/api-services-support@amazon\.com/i.test(html) || html.length < 10000) {
      if (attempt < 3) {
        await sleep(15000 * (attempt + 1));
        return fetchCategory(asin, attempt + 1);
      }
      return { ok: false, reason: "bot_page" };
    }
    const breadcrumbs = parseBreadcrumbs(html);
    const bsrRoot = parseBsrRoot(html);
    if (!breadcrumbs && !bsrRoot) {
      // Amazon serves a slimmed page under load that drops both blocks even
      // for healthy products — retry before concluding the page has neither.
      if (attempt < 2) {
        await sleep(5000 * (attempt + 1));
        return fetchCategory(asin, attempt + 1);
      }
      return { ok: true, breadcrumbs: null, bsrRoot: null };
    }
    return { ok: true, breadcrumbs, bsrRoot };
  } catch (err) {
    if (attempt < 2) {
      await sleep(4000 * (attempt + 1));
      return fetchCategory(asin, attempt + 1);
    }
    return { ok: false, reason: `error_${err?.name ?? "unknown"}` };
  }
}

// Work list = every unique live ASIN from the verify checkpoint.
const live = new Map();
for (const line of readFileSync(`${DIR}/verified.jsonl`, "utf8").split("\n")) {
  if (!line.trim()) continue;
  try {
    const r = JSON.parse(line);
    if (r.ok) live.set(r.asin, r);
  } catch {}
}

const seen = new Set();
if (existsSync(CKPT)) {
  for (const line of readFileSync(CKPT, "utf8").split("\n")) {
    if (!line.trim()) continue;
    try {
      const r = JSON.parse(line);
      // Keep hard verdicts; let throttle artifacts be retried on resume. An
      // ok row with neither signal predates bot-page detection — retry those.
      if (r.ok && !r.breadcrumbs && !r.bsrRoot) continue;
      if (r.ok || !["captcha", "bot_page", "error_TimeoutError"].includes(r.reason)) seen.add(r.asin);
    } catch {}
  }
  console.log(`resuming — ${seen.size} ASINs already swept`);
}

const todo = [...live.keys()].filter((a) => !seen.has(a));
console.log(`live ASINs: ${live.size} — fetching categories for ${todo.length}`);

let done = 0;
let cursor = 0;
await Promise.all(
  Array.from({ length: CONCURRENCY }, async () => {
    while (cursor < todo.length) {
      const asin = todo[cursor++];
      const r = await fetchCategory(asin);
      appendFileSync(CKPT, JSON.stringify({ asin, ...r }) + "\n");
      if (++done % 25 === 0) console.log(`  …${done}/${todo.length}`);
      await sleep(DELAY_MS + Math.floor(Math.random() * DELAY_MS));
    }
  })
);

console.log(`done — wrote ${CKPT}`);
