/**
 * One-time backlog push: resolve Amazon ASINs for the products that the free
 * catalog pass (scripts/backfill-asins-from-catalog.mjs) could not answer.
 *
 * Run AFTER the catalog pass — that one is free, this one spends credits.
 *
 * Deliberate choices:
 *  - TEXT SEARCH ONLY. The google_lens fallback cannot be relevance-checked
 *    (it returns no title to compare against), so at backlog scale it would
 *    attach unverifiable links to hundreds of products. Lens stays enabled on
 *    the just-in-time path where the volume is a handful per post.
 *  - PACED under the account's 200 searches/hour rate limit.
 *  - Every call is logged to SerpapiQuery so the budget report stays honest,
 *    even though this run intentionally bypasses the per-integration cap
 *    (it is a supervised one-off, bounded by --max, not an automated job).
 *
 * ⚠️ `normalizeTitle` / `titlesOverlap` below MUST stay in sync with
 * lib/shop/asin-match.ts, which is the source of truth and applies the same
 * guard on every scheduled lookup.
 *
 *   node --env-file=.env.local scripts/backfill-asins-serpapi.mjs                  # dry run
 *   node --env-file=.env.local scripts/backfill-asins-serpapi.mjs --write --max 450
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const WRITE = process.argv.includes("--write");
const arg = (f, d) => {
  const i = process.argv.indexOf(f);
  return i === -1 ? d : process.argv[i + 1];
};
const MAX_CALLS = Number(arg("--max", "450"));
const PER_HOUR = Number(arg("--per-hour", "180")); // account limit is 200/hr
const SPACING_MS = Math.ceil(3_600_000 / PER_HOUR);
const KEY = process.env.SERPAPI_KEY;
const INTEGRATION = "asin-backlog-push";

if (!KEY) {
  console.error("SERPAPI_KEY missing");
  process.exit(1);
}

const normalizeTitle = (t) =>
  (t ?? "")
    .toLowerCase()
    .replace(/\b(continue|delete draft|all listings|hide|this listing is being reviewed\.?|ty)\b/g, "")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const STOPWORDS = new Set([
  "the", "and", "for", "with", "new", "used", "size", "set", "pack", "inch",
  "black", "white", "blue", "red", "green", "gray", "grey", "large", "small",
  "medium", "kids", "womens", "mens", "rental", "rent", "listing", "draft",
]);
const stem = (t) => (t.length > 3 && t.endsWith("s") ? t.slice(0, -1) : t);
const sig = (t) =>
  new Set(normalizeTitle(t).split(" ").filter((x) => x.length >= 3 && !STOPWORDS.has(x)).map(stem));

function titlesOverlap(ours, theirs) {
  const a = sig(ours);
  const b = sig(theirs);
  if (!a.size || !b.size) return false;
  let shared = 0;
  for (const t of a) if (b.has(t)) shared += 1;
  if (a.size === 1) return shared >= 1;
  return shared >= 2;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function searchAmazon(query) {
  const url = new URL("https://serpapi.com/search.json");
  url.searchParams.set("engine", "amazon");
  url.searchParams.set("amazon_domain", "amazon.com");
  url.searchParams.set("k", query);
  url.searchParams.set("api_key", KEY);

  let success = false;
  let status = null;
  let error = null;
  let data = null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(25000) });
    status = res.status;
    const text = await res.text();
    try {
      data = JSON.parse(text);
    } catch {
      /* non-JSON */
    }
    success = res.ok;
    if (!res.ok) error = text.slice(0, 300);
    if (res.status === 429 || /run out of searches/i.test(text)) {
      error = "OUT_OF_QUOTA";
    }
  } catch (err) {
    error = String(err).slice(0, 300);
  }

  // Log every attempt so budgetReport() reflects this run.
  await prisma.serpapiQuery
    .create({
      data: { integration: INTEGRATION, engine: "amazon", query: query.slice(0, 500), success, status, error },
    })
    .catch(() => {});

  return { success, error, data };
}

const products = await prisma.product.findMany({
  where: { amazonAsin: null, status: { not: "archived" } },
  select: { id: true, title: true, searchKeywords: true },
  orderBy: { createdAt: "desc" },
});

const queued = products.filter((p) => ((p.searchKeywords ?? "") || (p.title ?? "")).trim().length >= 6);

console.log(`unmatched products : ${products.length}`);
console.log(`with a usable query: ${queued.length}`);
console.log(`budget this run    : ${MAX_CALLS} calls @ ${PER_HOUR}/hr → ~${(Math.min(queued.length, MAX_CALLS) * SPACING_MS / 3.6e6).toFixed(1)}h`);

if (!WRITE) {
  console.log("\n(dry run — re-run with --write)");
  await prisma.$disconnect();
  process.exit(0);
}

let calls = 0, matched = 0, rejected = 0, missed = 0;

for (const p of queued) {
  if (calls >= MAX_CALLS) {
    console.log(`\n[stop] hit --max ${MAX_CALLS}`);
    break;
  }
  const query = ((p.searchKeywords ?? "") || (p.title ?? "")).trim();
  const { success, error, data } = await searchAmazon(query);
  calls += 1;

  if (error === "OUT_OF_QUOTA") {
    console.log("\n[stop] SerpAPI out of quota / rate limited");
    break;
  }

  if (success && data) {
    const organic = Array.isArray(data.organic_results) ? data.organic_results : [];
    let hit = null;
    for (const item of organic) {
      if (typeof item.asin !== "string" || !/^[A-Z0-9]{10}$/.test(item.asin)) continue;
      const amazonTitle = typeof item.title === "string" ? item.title : "";
      // Guard: Amazon returns something for nearly any query.
      if (!titlesOverlap(query, amazonTitle)) continue;
      hit = { asin: item.asin, title: amazonTitle };
      break;
    }
    if (hit) {
      try {
        await prisma.product.update({
          where: { id: p.id },
          data: { amazonAsin: hit.asin, asinMatchScore: null, asinMatchedAt: new Date() },
        });
        matched += 1;
        console.log(`✅ ${hit.asin}  ${query.slice(0, 44)}  →  ${hit.title.slice(0, 44)}`);
      } catch (e) {
        console.log(`⚠️  write failed for ${p.id}`);
      }
    } else if (organic.length > 0) {
      rejected += 1;
      console.log(`🚫 rejected (no title overlap)  ${query.slice(0, 56)}`);
    } else {
      missed += 1;
      console.log(`—  no results  ${query.slice(0, 56)}`);
    }
  } else {
    missed += 1;
    console.log(`—  error  ${query.slice(0, 40)}  ${String(error).slice(0, 60)}`);
  }

  if (calls % 25 === 0) {
    console.log(`\n··· ${calls} calls · ${matched} matched · ${rejected} rejected · ${missed} missed ···\n`);
  }
  await sleep(SPACING_MS);
}

console.log(`\n═══ done ═══`);
console.log(`calls=${calls}  matched=${matched}  rejected=${rejected}  missed=${missed}`);
const left = await prisma.product.count({ where: { amazonAsin: null, status: { not: "archived" } } });
console.log(`unmatched remaining: ${left}`);
await prisma.$disconnect();
