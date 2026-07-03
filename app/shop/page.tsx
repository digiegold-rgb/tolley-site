import { unstable_noStore as noStore } from "next/cache";
import { prisma } from "@/lib/prisma";
import { timeAgo, TREASURE_HAUL_FB_URL } from "@/lib/shop";
import {
  parseShopFilters,
  buildPrismaWhere,
  buildPrismaOrderBy,
  hasAnyFilter,
  type ShopFilters,
} from "@/lib/shop/filters";
import ShopCard from "@/components/shop/ShopCard";
import CategoryStrip from "@/components/shop/CategoryStrip";
import FilterBar from "@/components/shop/FilterBar";
import SearchBox from "@/components/shop/SearchBox";
import ReviewBanner, {
  type ReviewBannerItem,
} from "@/components/shop/ReviewBanner";
import AmazonBountyStrip from "@/components/shop/AmazonBountyStrip";
import AmazonStorefrontEmbed from "@/components/shop/AmazonStorefrontEmbed";
import TreasureHaulHero from "@/components/shop/TreasureHaulHero";
import type { Prisma } from "@prisma/client";

export const revalidate = 300;

interface DisplayItem {
  id: string;
  title: string;
  price: number;
  shipPrice: number | null;
  amazonAsin: string | null;
  description: string | null;
  category: string | null;
  imageUrls: string[];
  videoUrl: string | null;
  createdAt: Date;
  fbStatus: string | null;
  fbListingId: string | null;
  source: "product" | "shopItem";
}

interface ProductRow {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  imageUrls: string[];
  videoUrl: string | null;
  shipPrice: number | null;
  amazonAsin: string | null;
  fbStatus: string | null;
  fbListingId: string | null;
  targetPrice: number | null;
  createdAt: Date;
  listings: { price: number }[];
}

const PRODUCT_SELECT = {
  id: true,
  title: true,
  description: true,
  category: true,
  imageUrls: true,
  videoUrl: true,
  shipPrice: true,
  amazonAsin: true,
  fbStatus: true,
  fbListingId: true,
  targetPrice: true,
  createdAt: true,
  listings: {
    where: { platform: "shop", status: "active" },
    select: { price: true },
  },
} satisfies Prisma.ProductSelect;

function rowToDisplay(p: ProductRow): DisplayItem {
  return {
    id: p.id,
    title: p.title,
    price: p.listings[0]?.price ?? p.targetPrice ?? 0,
    shipPrice: p.shipPrice ?? null,
    amazonAsin: p.amazonAsin ?? null,
    videoUrl: p.videoUrl ?? null,
    description: p.description,
    category: p.category,
    imageUrls: p.imageUrls,
    createdAt: p.createdAt,
    fbStatus: p.fbStatus,
    fbListingId: p.fbListingId,
    source: "product" as const,
  };
}

async function fetchItems(
  filters: ShopFilters,
  baseWhere: Prisma.ProductWhereInput
): Promise<DisplayItem[]> {
  const orderBy = buildPrismaOrderBy(filters);

  if (filters.cat) {
    // Two queries in parallel: one matching the active category, one with
    // everything else. Concat with the cat-matched group first so the active
    // category visually leads the grid even when sorted by something else.
    const withCat = buildPrismaWhere(filters, baseWhere);
    const withoutCatFilters: ShopFilters = { ...filters, cat: null };
    const withoutCat: Prisma.ProductWhereInput = {
      ...buildPrismaWhere(withoutCatFilters, baseWhere),
      NOT: { category: filters.cat },
    };

    const [matched, rest] = await Promise.all([
      prisma.product.findMany({
        where: withCat,
        orderBy,
        select: PRODUCT_SELECT,
      }),
      prisma.product.findMany({
        where: withoutCat,
        orderBy,
        select: PRODUCT_SELECT,
      }),
    ]);

    return [...matched, ...rest].map(rowToDisplay);
  }

  const where = buildPrismaWhere(filters, baseWhere);
  const rows = await prisma.product.findMany({
    where,
    orderBy,
    select: PRODUCT_SELECT,
  });
  return rows.map(rowToDisplay);
}

async function fetchBannerReviews(): Promise<ReviewBannerItem[]> {
  const rows = await prisma.review.findMany({
    where: { hidden: false },
    orderBy: [{ displayOrder: "asc" }, { reviewedAt: "desc" }],
    take: 8,
    select: {
      id: true,
      reviewerName: true,
      rating: true,
      body: true,
      notableTags: true,
      product: { select: { title: true } },
    },
  });

  return rows.map((r) => ({
    id: r.id,
    reviewerName: r.reviewerName,
    rating: r.rating,
    body: r.body,
    notableTags: r.notableTags,
    productTitle: r.product?.title ?? null,
  }));
}

async function fetchCategoryCounts(
  baseWhere: Prisma.ProductWhereInput
): Promise<Array<{ name: string; count: number }>> {
  const groups = await prisma.product.groupBy({
    by: ["category"],
    where: baseWhere,
    _count: { _all: true },
  });

  return groups
    .filter(
      (g): g is typeof g & { category: string } =>
        typeof g.category === "string" && g.category.length > 0
    )
    .map((g) => ({ name: g.category, count: g._count._all }))
    .filter((c) => c.count > 0);
}

async function fetchLastFbSyncAt(): Promise<Date | null> {
  const recent = await prisma.product.findFirst({
    where: { lastFbCheckAt: { not: null } },
    orderBy: { lastFbCheckAt: "desc" },
    select: { lastFbCheckAt: true },
  });
  return recent?.lastFbCheckAt ?? null;
}

export default async function ShopPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const filters = parseShopFilters(sp);

  // Filtered views opt out of ISR — they're per-user and shouldn't be cached
  // at the route level. The unfiltered storefront keeps `revalidate = 300`.
  if (hasAnyFilter(filters)) {
    noStore();
  }

  const baseWhere: Prisma.ProductWhereInput = {
    status: "listed",
    listings: { some: { platform: "shop", status: "active" } },
    // Hard rule: never list a product without at least one photo. A photo-less
    // tile looks broken and erodes trust. Fix the data in admin (re-upload
    // photos) before flipping these back to listed.
    imageUrls: { isEmpty: false },
  };

  // Every product card shows an Amazon CTA — direct ASIN when available,
  // tagged search-results fallback otherwise. Server-side endpoints resolve
  // the affiliate tag via resolveAmazonTag() with a hardcoded production
  // fallback, so the button works even if the env var is unset.
  const amazonEnabled = true;
  const amazonTag = process.env.AMAZON_AFFILIATE_TAG || "tolley-shop-20";

  const [items, bannerReviews, categoryCounts, lastFbSyncAt] = await Promise.all([
    fetchItems(filters, baseWhere),
    fetchBannerReviews(),
    fetchCategoryCounts(baseWhere),
    fetchLastFbSyncAt(),
  ]);

  if (items.length === 0 && !hasAnyFilter(filters)) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center text-center">
        <p className="text-4xl">🛍️</p>
        <h2 className="mt-4 text-xl font-bold text-white">
          Check back soon — new items daily!
        </h2>
        <p className="mt-2 text-sm text-white/50">
          Items get posted regularly. Follow on Facebook for first dibs.
        </p>
        <a
          href={TREASURE_HAUL_FB_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="shop-cta mt-6 rounded-full px-5 py-2 text-sm font-semibold text-white"
        >
          Follow on Facebook
        </a>
      </div>
    );
  }

  return (
    <div>
      {/* Search — top of /shop public storefront */}
      <SearchBox
        initial={filters.q}
        resultHint={
          filters.q
            ? `${items.length} match${items.length === 1 ? "" : "es"}`
            : undefined
        }
      />

      {/* Treasure Haul brand hero — only on the unfiltered Browse landing */}
      {!hasAnyFilter(filters) && <TreasureHaulHero />}

      {/* Amazon Haul strip — every item under $20, $4 first-purchase bounty */}
      {!hasAnyFilter(filters) && (
        <a
          href="/shop/haul"
          className="my-4 flex items-center justify-between rounded-xl border border-orange-500/30 bg-gradient-to-r from-orange-500/10 to-orange-500/5 px-4 py-3 transition hover:border-orange-500/60 hover:from-orange-500/15"
        >
          <div className="flex items-center gap-3">
            <span className="text-xl">🛒</span>
            <div>
              <p className="text-sm font-semibold text-orange-300">
                Amazon Haul — everything under $20
              </p>
              <p className="text-xs text-white/55">
                Hand-picked finds + Amazon's $4 first-purchase bounty
              </p>
            </div>
          </div>
          <span className="text-sm text-orange-400">Shop the Haul →</span>
        </a>
      )}

      {/* Amazon free-trial / signup bounties (renders nothing if none configured) */}
      <AmazonBountyStrip />

      {/* Review banner */}
      <ReviewBanner reviews={bannerReviews} />

      {/* Category strip */}
      <CategoryStrip categories={categoryCounts} active={filters.cat} />

      {/* Filter bar */}
      <FilterBar
        initial={{
          minCents: filters.minCents,
          maxCents: filters.maxCents,
          pickup: filters.pickup,
          ship: filters.ship,
          sort: filters.sort,
        }}
        resultCount={items.length}
      />

      {items.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-white/5 px-6 py-12 text-center">
          <p className="text-sm text-white/65">
            {filters.q
              ? `No items match “${filters.q}”. Try a shorter or different word, or clear the search.`
              : "No items match those filters. Try widening your price range or clearing filters above."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {items.map((item, i) => (
            <ShopCard
              key={item.id}
              item={item}
              delay={Math.min(i, 5) * 50}
              amazonEnabled={amazonEnabled}
              amazonTag={amazonTag}
            />
          ))}
        </div>
      )}

      {/* Bottom CTA */}
      <div className="mt-8 text-center">
        <p className="text-sm text-white/60">
          Most items are <span className="text-white/90">local pickup</span> in
          the Kansas City metro. Tap any item above to message Ruthann directly
          on Facebook and arrange a time.
        </p>
        <a
          href={TREASURE_HAUL_FB_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="shop-cta mt-3 inline-block rounded-full px-6 py-2.5 text-sm font-semibold text-white"
        >
          See all listings on Facebook
        </a>
        {lastFbSyncAt && (
          <p className="mt-4 text-[0.65rem] uppercase tracking-wide text-white/25">
            Marketplace inventory synced {timeAgo(lastFbSyncAt)}
          </p>
        )}
      </div>

      {/* Amazon Influencer storefront — moved to bottom so the local resale
          inventory leads the page; Amazon picks live below as a secondary CTA. */}
      <div className="mt-8">
        <AmazonStorefrontEmbed />
      </div>
    </div>
  );
}
