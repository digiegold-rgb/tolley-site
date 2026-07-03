/**
 * Loop every Product without an amazonAsin, hit /api/shop/products/[id]/find-amazon,
 * log results. Runs locally via `npx tsx scripts/bulk-find-asins.ts`.
 *
 * Requires:
 *   - asin-finder-worker live (catalog seeded with at least some ASINs)
 *   - ASIN_FINDER_URL + ASIN_FINDER_SECRET set in tolley-site/.env.local
 *   - SHOP_ADMIN_COOKIE set to a valid shop_admin cookie value
 *
 * Concurrency is intentionally 1 — embedding is CPU-bound on the worker.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const ASIN_URL = process.env.ASIN_FINDER_URL;
const ASIN_SECRET = process.env.ASIN_FINDER_SECRET;
const MIN_SCORE = parseFloat(process.env.MIN_SCORE || "0.55");

if (!ASIN_URL || !ASIN_SECRET) {
  console.error("Missing ASIN_FINDER_URL / ASIN_FINDER_SECRET");
  process.exit(1);
}

interface SearchResult {
  asin: string;
  title: string;
  score: number;
}

async function findAsin(imageUrl: string): Promise<SearchResult[]> {
  const res = await fetch(`${ASIN_URL}/search`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${ASIN_SECRET}`,
    },
    body: JSON.stringify({ image_url: imageUrl, top_k: 3 }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as { results: SearchResult[] };
  return data.results || [];
}

async function main() {
  const products = await prisma.product.findMany({
    where: {
      amazonAsin: null,
      status: { in: ["listed", "draft"] },
      imageUrls: { isEmpty: false },
    },
    select: { id: true, title: true, imageUrls: true },
    orderBy: { createdAt: "desc" },
  });

  console.log(`Found ${products.length} products without an ASIN.`);

  let matched = 0;
  let skipped = 0;
  let errored = 0;

  for (let i = 0; i < products.length; i++) {
    const p = products[i];
    const tag = `[${i + 1}/${products.length}]`;
    const title = p.title.slice(0, 60);
    try {
      const results = await findAsin(p.imageUrls[0]);
      const top = results[0];
      if (!top) {
        console.log(`${tag} ${title} — no candidates`);
        skipped++;
        continue;
      }
      if (top.score < MIN_SCORE) {
        console.log(
          `${tag} ${title} — best=${top.asin} score=${top.score.toFixed(3)} (below ${MIN_SCORE})`
        );
        skipped++;
        continue;
      }
      await prisma.product.update({
        where: { id: p.id },
        data: {
          amazonAsin: top.asin,
          asinMatchScore: top.score,
          asinMatchedAt: new Date(),
        },
      });
      console.log(
        `${tag} ${title} → ${top.asin} score=${top.score.toFixed(3)} ✓`
      );
      matched++;
    } catch (err) {
      console.error(`${tag} ${title} ERROR:`, err instanceof Error ? err.message : err);
      errored++;
    }
  }

  console.log(
    `\nDone. matched=${matched} skipped=${skipped} errored=${errored} of ${products.length}`
  );
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
