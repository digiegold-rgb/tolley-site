/**
 * One-time backfill: resolve ASINs for unmatched products from ASINs we
 * already know, using normalized-title equality. Costs nothing — no SerpAPI.
 *
 * Ruthann relists the same inventory constantly, so ~30% of the unmatched
 * backlog is already answered elsewhere in our own catalog. The Momcozy
 * bottle washer that went out on the 7/28 Page post with no affiliate link
 * already had B0CWLHKQNT on 61 other rows.
 *
 * The matching rules here MUST stay in sync with `normalizeTitle` /
 * `isSpecificEnough` in lib/shop/asin-match.ts — that module is the source of
 * truth and runs this same pass before every paid lookup. This script exists
 * only to sweep the standing backlog in one go.
 *
 *   node --env-file=.env.local scripts/backfill-asins-from-catalog.mjs          # dry run
 *   node --env-file=.env.local scripts/backfill-asins-from-catalog.mjs --write
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const WRITE = process.argv.includes("--write");

const normalizeTitle = (title) =>
  (title ?? "")
    .toLowerCase()
    .replace(/\b(continue|delete draft|all listings|hide|this listing is being reviewed\.?|ty)\b/g, "")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const isSpecificEnough = (norm) => norm.length >= 12 && norm.split(" ").length >= 3;

const known = await prisma.product.findMany({
  where: { amazonAsin: { not: null } },
  select: { title: true, amazonAsin: true },
});
const index = new Map();
for (const k of known) {
  const norm = normalizeTitle(k.title);
  if (isSpecificEnough(norm) && !index.has(norm)) index.set(norm, k.amazonAsin);
}

const unmatched = await prisma.product.findMany({
  where: { amazonAsin: null, status: { not: "archived" } },
  select: { id: true, title: true },
});

const hits = [];
for (const u of unmatched) {
  const norm = normalizeTitle(u.title);
  if (!isSpecificEnough(norm)) continue;
  const asin = index.get(norm);
  if (asin) hits.push({ id: u.id, title: u.title, asin });
}

console.log(`known ASINs indexed : ${index.size}`);
console.log(`unmatched products  : ${unmatched.length}`);
console.log(`resolvable for FREE : ${hits.length}`);

if (!WRITE) {
  console.log("\n(dry run — re-run with --write to apply)");
  for (const h of hits.slice(0, 20)) console.log(`  ${h.asin}  ${h.title?.slice(0, 60)}`);
  await prisma.$disconnect();
  process.exit(0);
}

let ok = 0;
let failed = 0;
for (const h of hits) {
  try {
    await prisma.product.update({
      where: { id: h.id },
      data: { amazonAsin: h.asin, asinMatchScore: null, asinMatchedAt: new Date() },
    });
    ok += 1;
  } catch {
    failed += 1;
  }
}
console.log(`\nwrote ${ok}, failed ${failed}`);
await prisma.$disconnect();
