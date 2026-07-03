import type { Metadata } from "next";
import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import ShopCard from "@/components/shop/ShopCard";
import SearchBox from "@/components/shop/SearchBox";
import FilterBar from "@/components/shop/FilterBar";
import CategoryStrip from "@/components/shop/CategoryStrip";
import {
  parseShopFilters,
  buildPrismaWhere,
  buildPrismaOrderBy,
  hasAnyFilter,
  filtersToSearchParams,
} from "@/lib/shop/filters";

export const revalidate = 600;

export const metadata: Metadata = {
  title: "Sold Items | tolley.io/shop",
  description:
    "Items recently sold from tolley.io/shop. Missed it? Browse our Amazon picks for similar finds.",
  alternates: { canonical: "https://www.tolley.io/shop/sold" },
  openGraph: {
    title: "Sold Items | tolley.io/shop",
    description: "Recently sold items — and Amazon alternatives.",
    url: "https://www.tolley.io/shop/sold",
    type: "website",
  },
};

const PAGE_SIZE = 60;

type SearchParams = Record<string, string | string[] | undefined>;

function getStr(sp: SearchParams, key: string): string | undefined {
  const v = sp[key];
  if (Array.isArray(v)) return v[0];
  return v;
}

function pagedHref(filters: ReturnType<typeof parseShopFilters>, page: number) {
  const params = filtersToSearchParams(filters);
  if (page > 1) params.set("page", String(page));
  const qs = params.toString();
  return qs ? `/shop/sold?${qs}` : "/shop/sold";
}

export default async function SoldPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const pageRaw = parseInt(getStr(sp, "page") || "1", 10);
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;

  const filters = parseShopFilters(sp);

  // Filtered views opt out of ISR (mirrors /shop behavior — same reason).
  if (hasAnyFilter(filters)) {
    noStore();
  }

  const baseWhere: Prisma.ProductWhereInput = {
    status: "sold",
    // Mirror /shop — never list a tile with no photo.
    imageUrls: { isEmpty: false },
  };
  const where = buildPrismaWhere(filters, baseWhere);
  const orderBy = hasAnyFilter(filters)
    ? buildPrismaOrderBy(filters)
    : [{ soldAt: "desc" as const }, { createdAt: "desc" as const }];

  const [products, total, totalUnfiltered, categoryGroups] = await Promise.all([
    prisma.product.findMany({
      where,
      include: {
        listings: {
          where: { platform: "shop" },
          take: 1,
        },
      },
      orderBy,
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
    }),
    prisma.product.count({ where }),
    prisma.product.count({ where: baseWhere }),
    prisma.product.groupBy({
      by: ["category"],
      where: baseWhere,
      _count: { _all: true },
    }),
  ]);

  const categoryCounts = categoryGroups
    .filter(
      (g): g is typeof g & { category: string } =>
        typeof g.category === "string" && g.category.length > 0
    )
    .map((g) => ({ name: g.category, count: g._count._all }))
    .filter((c) => c.count > 0);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasPrev = page > 1;
  const hasNext = page < totalPages;
  // Sold cards keep the Amazon CTA enabled — even after we've moved the
  // physical item, the affiliate click still earns commission and Ruthann's
  // fans browse the sold gallery for inspiration.
  const amazonEnabled = true;
  const amazonTag = process.env.AMAZON_AFFILIATE_TAG || "tolley-shop-20";

  // Cold empty state only when the catalog itself is empty — keep filter UI
  // visible whenever there are sold items, even if the current filter has 0 hits.
  if (totalUnfiltered === 0) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center text-center">
        <p className="text-4xl">📦</p>
        <h2 className="mt-4 text-xl font-bold text-white">
          No sold items yet
        </h2>
        <p className="mt-2 text-sm text-white/50">
          Once items move, they&rsquo;ll show here so buyers can browse what
          they missed (with Amazon alternatives).
        </p>
        <Link
          href="/shop"
          className="shop-cta mt-6 rounded-full px-5 py-2 text-sm font-semibold text-white"
        >
          Shop active items
        </Link>
      </div>
    );
  }

  return (
    <div>
      <SearchBox
        initial={filters.q}
        resultHint={
          filters.q
            ? `${total} match${total === 1 ? "" : "es"}`
            : undefined
        }
      />

      <div className="mb-4 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-xs text-white/70">
        <span className="font-semibold text-white/90">Sold items.</span>{" "}
        These have already moved — but if Amazon has a similar pick, the
        button below the photo will take you straight to a comparable product
        (affiliate).
      </div>

      <CategoryStrip categories={categoryCounts} active={filters.cat} />

      <FilterBar
        initial={{
          minCents: filters.minCents,
          maxCents: filters.maxCents,
          pickup: filters.pickup,
          ship: filters.ship,
          sort: filters.sort,
        }}
        resultCount={total}
      />

      {total === 0 ? (
        <div className="rounded-xl border border-white/10 bg-white/5 px-6 py-12 text-center">
          <p className="text-sm text-white/65">
            {filters.q
              ? `No sold items match “${filters.q}”. Try a shorter or different word, or clear the search.`
              : "No sold items match those filters. Try widening your price range or clearing filters above."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {products.map((p, i) => {
            const item = {
              id: p.id,
              title: p.title,
              price: p.listings[0]?.price ?? p.targetPrice ?? p.soldPrice ?? 0,
              shipPrice: p.shipPrice ?? null,
              amazonAsin: p.amazonAsin ?? null,
              description: p.description,
              category: p.category,
              imageUrls: p.imageUrls,
              videoUrl: p.videoUrl ?? null,
              createdAt: p.createdAt,
              fbStatus: p.fbStatus,
              fbListingId: p.fbListingId,
            };
            return (
              <ShopCard
                key={p.id}
                item={item}
                delay={Math.min(i, 5) * 50}
                amazonEnabled={amazonEnabled}
                amazonTag={amazonTag}
                variant="sold"
              />
            );
          })}
        </div>
      )}

      {(hasPrev || hasNext) && (
        <nav
          aria-label="Pagination"
          className="mt-8 flex items-center justify-center gap-3 text-sm"
        >
          {hasPrev ? (
            <Link
              href={pagedHref(filters, page - 1)}
              className="rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-white/80 hover:border-white/30 hover:text-white"
            >
              ← Prev
            </Link>
          ) : (
            <span className="rounded-full border border-white/10 bg-white/[0.02] px-4 py-1.5 text-white/30">
              ← Prev
            </span>
          )}
          <span className="text-xs text-white/50">
            Page {page} of {totalPages}
          </span>
          {hasNext ? (
            <Link
              href={pagedHref(filters, page + 1)}
              className="rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-white/80 hover:border-white/30 hover:text-white"
            >
              Next →
            </Link>
          ) : (
            <span className="rounded-full border border-white/10 bg-white/[0.02] px-4 py-1.5 text-white/30">
              Next →
            </span>
          )}
        </nav>
      )}
    </div>
  );
}
