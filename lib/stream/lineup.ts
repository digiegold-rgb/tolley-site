// /stream product lineups — shared server helpers for app/api/stream-lineup/*.
import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { plainAmazonUrl } from "@/lib/shop/amazon-asin";

export const RESERVED_SLUGS = new Set(["products", "new"]);

export const PRODUCT_SELECT = {
  id: true,
  title: true,
  description: true,
  imageUrls: true,
  brand: true,
  condition: true,
  targetPrice: true,
  minPrice: true,
  aiSuggestedPrice: true,
  weightOz: true,
  amazonAsin: true,
  asinMatchScore: true,
  status: true,
  fbStatus: true,
  inventory: true,
} satisfies Prisma.ProductSelect;

export const ITEM_INCLUDE = { product: { select: PRODUCT_SELECT } } satisfies Prisma.StreamLineupItemInclude;

export function slugify(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

/** feed-1, feed-2, … — first free number. */
export async function nextFeedSlug(): Promise<string> {
  const rows = await prisma.streamLineup.findMany({ select: { slug: true } });
  const taken = new Set(rows.map((r) => r.slug));
  for (let n = 1; ; n++) {
    if (!taken.has(`feed-${n}`)) return `feed-${n}`;
  }
}

export function productPrice(p: { targetPrice: number | null; minPrice: number | null; aiSuggestedPrice: number | null }): number | null {
  return p.targetPrice ?? p.minPrice ?? p.aiSuggestedPrice ?? null;
}

/**
 * Last Amazon price we already have on file for an ASIN — the product cache first, else the price seen when the
 * item was bulk-ingested. Stored data only: never a paid lookup. It is a presenter note; the big screen shows today's.
 */
export async function cachedAmazonPriceCents(asin: string | null): Promise<number | null> {
  if (!asin) return null;
  const row = await prisma.amazonProductCache.findUnique({ where: { asin }, select: { priceCents: true } });
  if (row?.priceCents) return row.priceCents;
  // No index on amazonAsin, but the table is small (one row per ingested photo group).
  const job = await prisma.bulkIngestJob.findFirst({
    where: { amazonAsin: asin, amazonPriceCents: { not: null } },
    orderBy: { createdAt: "desc" },
    select: { amazonPriceCents: true },
  });
  return job?.amazonPriceCents ?? null;
}

/** Defaults for a new lineup item, taken from the product. amazonUrl is a plain /dp/ link (no affiliate tag). */
export async function itemDefaults(product: {
  amazonAsin: string | null;
  targetPrice: number | null;
  minPrice: number | null;
  aiSuggestedPrice: number | null;
  weightOz: number | null;
}) {
  return {
    amazonUrl: product.amazonAsin ? plainAmazonUrl(product.amazonAsin) : null,
    amazonPriceCents: await cachedAmazonPriceCents(product.amazonAsin),
    salePrice: productPrice(product),
    weightOz: product.weightOz,
  };
}

export async function getLineup(slug: string) {
  return prisma.streamLineup.findUnique({
    where: { slug },
    include: { items: { orderBy: { sortOrder: "asc" }, include: ITEM_INCLUDE } },
  });
}
