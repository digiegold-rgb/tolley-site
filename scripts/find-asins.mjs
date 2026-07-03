#!/usr/bin/env node
/**
 * Per-product Amazon ASIN finder via SerpAPI Amazon Search.
 *
 * For every Product without an amazonAsin, queries SerpAPI with the title
 * (or searchKeywords if present) and persists the top organic ASIN.
 *
 *   SERPAPI_KEY=... node scripts/find-asins.mjs           # all unmatched
 *   SERPAPI_KEY=... LIMIT=50 node scripts/find-asins.mjs  # cap run
 *   SERPAPI_KEY=... DRY=1 node scripts/find-asins.mjs     # no DB writes
 *
 * Cost: ~$0.005 per query on SerpAPI's Free→Production tier ($75/mo for 5k).
 * For 406 unmatched products that's ~$2.05 one-time. Re-running on new
 * inventory is incremental, only hits products without an ASIN.
 */
import { PrismaClient } from "@prisma/client";

const SERPAPI_KEY = process.env.SERPAPI_KEY;
if (!SERPAPI_KEY) {
  console.error(
    "SERPAPI_KEY missing. Get one at https://serpapi.com/manage-api-key (Pro plan = 5k/mo for $75)."
  );
  process.exit(1);
}

const LIMIT = process.env.LIMIT ? Number(process.env.LIMIT) : Infinity;
const DRY = process.env.DRY === "1";
const CONCURRENCY = Number(process.env.CONCURRENCY) || 4;
const PAUSE_MS = Number(process.env.PAUSE_MS) || 250;

const db = new PrismaClient();

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Hit SerpAPI Amazon engine. Returns { asin, title, score } for top organic
 * result, or null when no usable result.
 */
async function findAsin(query) {
  const url = new URL("https://serpapi.com/search.json");
  url.searchParams.set("engine", "amazon");
  url.searchParams.set("amazon_domain", "amazon.com");
  url.searchParams.set("k", query);
  url.searchParams.set("api_key", SERPAPI_KEY);

  const res = await fetch(url, { method: "GET" });
  if (!res.ok) {
    throw new Error(`SerpAPI ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  const data = await res.json();
  const organic = Array.isArray(data?.organic_results) ? data.organic_results : [];
  for (const hit of organic) {
    const asin =
      typeof hit.asin === "string" && /^[A-Z0-9]{10}$/.test(hit.asin)
        ? hit.asin
        : null;
    if (!asin) continue;
    return {
      asin,
      title: hit.title ?? null,
      score: typeof hit.relevance_score === "number" ? hit.relevance_score : null,
    };
  }
  return null;
}

async function main() {
  const products = await db.product.findMany({
    where: { amazonAsin: null, status: { not: "archived" } },
    select: { id: true, title: true, searchKeywords: true },
    orderBy: { createdAt: "desc" },
    take: Number.isFinite(LIMIT) ? LIMIT : undefined,
  });

  console.log(
    `Matching ${products.length} products to ASINs (concurrency=${CONCURRENCY}, dry=${DRY})…`
  );

  let matched = 0;
  let missed = 0;
  let errored = 0;

  for (let i = 0; i < products.length; i += CONCURRENCY) {
    const batch = products.slice(i, i + CONCURRENCY);
    await Promise.all(
      batch.map(async (p) => {
        const query = p.searchKeywords?.trim() || p.title?.trim();
        if (!query) {
          missed += 1;
          return;
        }
        try {
          const hit = await findAsin(query);
          if (!hit) {
            missed += 1;
            return;
          }
          if (!DRY) {
            await db.product.update({
              where: { id: p.id },
              data: {
                amazonAsin: hit.asin,
                asinMatchScore: hit.score,
                asinMatchedAt: new Date(),
              },
            });
          }
          matched += 1;
          console.log(`  ✓ ${hit.asin}  ←  ${query.slice(0, 60)}`);
        } catch (err) {
          errored += 1;
          console.error(`  ✗ ${query.slice(0, 60)}: ${err.message}`);
        }
      })
    );
    if (i + CONCURRENCY < products.length) await sleep(PAUSE_MS);
  }

  console.log(
    `\nDone. matched=${matched} missed=${missed} errored=${errored} total=${products.length}`
  );
  await db.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await db.$disconnect();
  process.exit(1);
});
