/**
 * Build a curated, LIVE-VERIFIED ASIN list for the Amazon Influencer
 * storefront (amazon.com/shop/digitaljared) out of the Facebook resale
 * catalog.
 *
 * The bridge: our FB items are secondhand goods we physically own, which can
 * never live on an Amazon storefront. But `Product.amazonAsin` already holds
 * the *new equivalent* on Amazon for 1,412 of them. Those ASINs are the
 * addable inventory.
 *
 * Ranking leans on demand we have already observed rather than guesses:
 * an item that SOLD on Marketplace proved our audience buys it.
 *
 * Usage: node scripts/storefront-build.mjs [--limit 300] [--out DIR]
 */
import { PrismaClient } from "@prisma/client";
import { writeFileSync, mkdirSync, appendFileSync, existsSync, readFileSync } from "node:fs";

const args = process.argv.slice(2);
const argVal = (flag, def) => {
  const i = args.indexOf(flag);
  return i === -1 ? def : args[i + 1];
};
const LIMIT = Number(argVal("--limit", 300));
const OUT = argVal("--out", "/home/jelly/Shared/amazon-push/storefront");
const CONCURRENCY = Number(argVal("--concurrency", 2));
const DELAY_MS = Number(argVal("--delay", 900));

/**
 * Amazon serves a stripped bot page (no productTitle) to bare curl-style
 * requests and hands out captchas under load. A full Chrome header set plus
 * gentle pacing is the difference between ~3% and ~95% usable responses.
 */
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

const prisma = new PrismaClient();

/** Marketplace scrapes drag UI chrome into titles; strip it for display. */
function cleanTitle(t) {
  return (t ?? "")
    .replace(/\b(Continue|Delete draft|All listings|Hide|This listing is being reviewed\.?)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

const decode = (s) =>
  s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();

/**
 * A 200 from Amazon proves nothing — dead ASINs, dog pages and "Currently
 * unavailable" all return 200. Only a real product title plus a buyable
 * signal counts as live.
 */
async function verify(asin, attempt = 0) {
  try {
    const res = await fetch(`https://www.amazon.com/dp/${asin}`, {
      headers: HEADERS,
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) {
      // 503 is Amazon's throttle, not a dead ASIN — back off and retry.
      if ((res.status === 503 || res.status === 429) && attempt < 3) {
        await sleep(4000 * (attempt + 1));
        return verify(asin, attempt + 1);
      }
      return { ok: false, reason: `http_${res.status}` };
    }
    const html = await res.text();

    if (/Enter the characters you see below/i.test(html)) {
      if (attempt < 3) {
        await sleep(6000 * (attempt + 1));
        return verify(asin, attempt + 1);
      }
      return { ok: false, reason: "captcha" };
    }
    if (/Page Not Found|we couldn't find that page|Looking for something\?/i.test(html))
      return { ok: false, reason: "not_found" };

    const title = html.match(/<span[^>]*id="productTitle"[^>]*>([\s\S]*?)<\/span>/i)?.[1];
    if (!title) {
      if (attempt < 2) {
        await sleep(5000 * (attempt + 1));
        return verify(asin, attempt + 1);
      }
      return { ok: false, reason: "no_title" };
    }

    /**
     * Scope the stock check to the buybox. A detail page is ~3MB and the
     * phrase "currently unavailable" shows up in recommendation carousels and
     * variation pickers for perfectly buyable products, so matching the whole
     * document rejects live inventory.
     */
    const availability =
      html.match(/primary-availability-message[^>]*>([\s\S]{0,200}?)<\/span>/i)?.[1] ??
      html.match(/id="availability"[\s\S]{0,600}?<\/div>/i)?.[0] ??
      "";
    if (/currently unavailable|no longer available|out of stock/i.test(availability))
      return { ok: false, reason: "unavailable" };

    const priceRaw =
      html.match(/<span class="a-offscreen">\s*\$([\d,]+\.\d{2})\s*<\/span>/)?.[1] ?? null;
    const img = html.match(/"hiRes":"(https:\/\/[^"]+)"/)?.[1] ?? null;
    const rating = html.match(/([\d.]+) out of 5 stars/)?.[1] ?? null;

    return {
      ok: true,
      title: decode(title),
      price: priceRaw ? Number(priceRaw.replace(/,/g, "")) : null,
      rating: rating ? Number(rating) : null,
      image: img,
    };
  } catch (err) {
    return { ok: false, reason: `error_${err?.name ?? "unknown"}` };
  }
}

/** Bounded worker pool — polite to Amazon, and keeps a stall from blocking all. */
async function pool(items, worker, size) {
  const out = new Array(items.length);
  let cursor = 0;
  await Promise.all(
    Array.from({ length: size }, async () => {
      while (cursor < items.length) {
        const i = cursor++;
        out[i] = await worker(items[i], i);
        // Jittered pacing — a fixed interval reads as a bot.
        await sleep(DELAY_MS + Math.floor(Math.random() * DELAY_MS));
      }
    })
  );
  return out;
}

const products = await prisma.product.findMany({
  where: { amazonAsin: { not: null } },
  select: {
    id: true, title: true, category: true, subcategory: true, brand: true,
    amazonAsin: true, status: true, soldPrice: true, soldAt: true,
    targetPrice: true, aiSuggestedPrice: true, fbListingId: true,
  },
});

// One row per ASIN. Many products are relists of the same item, so collapse
// them and keep the strongest evidence across the group.
const byAsin = new Map();
for (const p of products) {
  const asin = p.amazonAsin.trim().toUpperCase();
  if (!/^B[0-9A-Z]{9}$|^\d{10}$/.test(asin)) continue;
  const prev = byAsin.get(asin) ?? {
    asin, title: "", category: null, soldCount: 0, listedCount: 0,
    lastSoldAt: null, price: null,
  };
  const t = cleanTitle(p.title);
  if (t.length > prev.title.length) prev.title = t;
  prev.category ??= p.category ?? p.subcategory ?? null;
  if (p.status === "sold") {
    prev.soldCount++;
    if (!prev.lastSoldAt || (p.soldAt && p.soldAt > prev.lastSoldAt)) prev.lastSoldAt = p.soldAt;
  }
  if (p.status === "listed") prev.listedCount++;
  prev.price ??= p.soldPrice ?? p.targetPrice ?? p.aiSuggestedPrice ?? null;
  byAsin.set(asin, prev);
}

const ranked = [...byAsin.values()]
  .map((r) => ({
    ...r,
    // Sales on Marketplace are the only real demand signal we own; a live
    // listing is the next best thing. Everything else is a guess.
    score: r.soldCount * 10 + r.listedCount * 6 + (r.price && r.price >= 25 ? 2 : 0),
  }))
  .sort((a, b) => b.score - a.score || (b.lastSoldAt ?? 0) - (a.lastSoldAt ?? 0));

mkdirSync(OUT, { recursive: true });
const CKPT = `${OUT}/verified.jsonl`;

/**
 * Verification is ~1k slow page loads against a host that throttles, so every
 * result is checkpointed as it lands and already-seen ASINs are skipped. A
 * crash, a restart or a retune costs nothing already paid for.
 */
const seen = new Map();
if (existsSync(CKPT)) {
  for (const line of readFileSync(CKPT, "utf8").split("\n")) {
    if (!line.trim()) continue;
    try {
      const r = JSON.parse(line);
      // Throttle artifacts are not verdicts — let those ASINs be retried.
      if (r.ok || !["captcha", "no_title", "error_TimeoutError"].includes(r.reason))
        seen.set(r.asin, r);
    } catch {}
  }
  console.log(`resuming — ${seen.size} ASINs already verified`);
}

console.log(`unique ASINs: ${ranked.length} — verifying top ${LIMIT} against Amazon…`);

const candidates = ranked.slice(0, LIMIT).filter((r) => !seen.has(r.asin));
let done = 0;
const verified = await pool(
  candidates,
  async (row) => {
    const v = await verify(row.asin);
    if (++done % 25 === 0) console.log(`  …${done}/${candidates.length}`);
    const { title: amazonTitle, ...rest } = v;
    const merged = { ...row, ...rest, title_amazon: amazonTitle ?? null };
    appendFileSync(CKPT, JSON.stringify(merged) + "\n");
    return merged;
  },
  CONCURRENCY
);

const all = [...seen.values(), ...verified.filter(Boolean)];
const live = all.filter((r) => r.ok);
const dead = all.filter((r) => !r.ok);
const reasons = dead.reduce((m, r) => ({ ...m, [r.reason]: (m[r.reason] ?? 0) + 1 }), {});

const csv = [
  "asin,amazon_title,our_title,category,amazon_price,rating,fb_sold,fb_listed,storefront_url",
  ...live.map((r) =>
    [
      r.asin,
      `"${(r.title_amazon ?? r.title ?? "").replace(/"/g, '""')}"`,
      `"${(r.title ?? "").replace(/"/g, '""')}"`,
      `"${r.category ?? ""}"`,
      r.price ?? "",
      r.rating ?? "",
      r.soldCount,
      r.listedCount,
      `https://www.amazon.com/dp/${r.asin}?tag=tolley-shop-20`,
    ].join(",")
  ),
].join("\n");
writeFileSync(`${OUT}/storefront-asins.csv`, csv);
writeFileSync(`${OUT}/storefront-asins.json`, JSON.stringify(live, null, 2));
writeFileSync(`${OUT}/asins-paste.txt`, live.map((r) => r.asin).join("\n"));
writeFileSync(
  `${OUT}/rejected.json`,
  JSON.stringify(dead.map(({ asin, title, reason }) => ({ asin, title, reason })), null, 2)
);

console.log(`\nLIVE: ${live.length}   DEAD: ${dead.length}`, reasons);
console.log(`proven demand (sold on FB): ${live.filter((r) => r.soldCount > 0).length}`);
console.log(`wrote → ${OUT}/`);

await prisma.$disconnect();
