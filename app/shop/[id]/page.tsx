import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { MoreFromTolley } from "@/components/shared/more-from-tolley";
import { EmailCaptureForm } from "@/components/tools/EmailCaptureForm";
import ProductPageView from "@/components/shop/ProductPageView";
import ShopCard from "@/components/shop/ShopCard";
import type { Prisma } from "@prisma/client";
import shortsMap from "@/lib/shop/shorts-map.json";

// ASIN -> latest posted YouTube Short (synced from the DGX growth-engine
// ledger by scripts/sync-shorts-map.mjs at deploy time)
const SHORTS: Record<string, { v: string; title: string; at: string }> =
  shortsMap as Record<string, { v: string; title: string; at: string }>;

export const revalidate = 300;

const BASE = "https://www.tolley.io";

const PAGE_SELECT = {
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
  status: true,
  soldPrice: true,
  goSlug: true,
  createdAt: true,
  updatedAt: true,
  listings: {
    where: { platform: "shop" },
    select: { price: true, status: true },
  },
} satisfies Prisma.ProductSelect;

type PageProduct = Prisma.ProductGetPayload<{ select: typeof PAGE_SELECT }>;

/**
 * Resolve by cuid OR goSlug — /go/[code] and Treasure Haul FB posts deep-link
 * with the product id; goSlug gives pretty shareable URLs for the same page.
 */
async function fetchProduct(idOrSlug: string): Promise<PageProduct | null> {
  return prisma.product.findFirst({
    where: { OR: [{ id: idOrSlug }, { goSlug: idOrSlug }] },
    select: PAGE_SELECT,
  });
}

function productPrice(p: PageProduct): number {
  const active = p.listings.find((l) => l.status === "active");
  return active?.price ?? p.soldPrice ?? p.listings[0]?.price ?? p.targetPrice ?? 0;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const product = await fetchProduct(id);
  if (!product) return { title: "Not found | tolley.io/shop" };

  const sold = product.status === "sold";
  const price = productPrice(product);
  const description =
    product.description?.slice(0, 155) ??
    `${product.title} — ${sold ? "sold, see similar finds" : `$${price}, local pickup in the Kansas City metro`}. Ruthann's Treasure Haul on tolley.io/shop.`;

  return {
    title: `${product.title} | tolley.io/shop`,
    description,
    openGraph: {
      title: product.title,
      description,
      url: `${BASE}/shop/${product.id}`,
      type: "website",
      images: product.imageUrls.slice(0, 1).map((url) => ({ url })),
    },
    twitter: {
      card: "summary_large_image",
      title: product.title,
      description,
      images: product.imageUrls.slice(0, 1),
    },
    alternates: { canonical: `${BASE}/shop/${product.id}` },
  };
}

function productJsonLd(product: PageProduct, price: number) {
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": `${BASE}/shop/${product.id}`,
    name: product.title,
    image: product.imageUrls,
    ...(product.description ? { description: product.description } : {}),
    ...(product.category ? { category: product.category } : {}),
    offers: {
      "@type": "Offer",
      url: `${BASE}/shop/${product.id}`,
      price: price.toFixed(2),
      priceCurrency: "USD",
      availability:
        product.status === "sold"
          ? "https://schema.org/SoldOut"
          : "https://schema.org/InStock",
      itemCondition: "https://schema.org/UsedCondition",
      seller: {
        "@type": "Organization",
        name: "Ruthann's Treasure Haul",
        url: `${BASE}/shop`,
      },
    },
  };
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const product = await fetchProduct(id);
  if (!product || product.imageUrls.length === 0) notFound();

  const price = productPrice(product);
  const amazonTag = process.env.AMAZON_AFFILIATE_TAG || "tolley-shop-20";

  // Related finds — same category first, newest listed as filler. Internal
  // links here are also what lets Google crawl the catalog from any product.
  const relatedWhere: Prisma.ProductWhereInput = {
    id: { not: product.id },
    status: "listed",
    listings: { some: { platform: "shop", status: "active" } },
    imageUrls: { isEmpty: false },
  };
  const [sameCategory, newest] = await Promise.all([
    product.category
      ? prisma.product.findMany({
          where: { ...relatedWhere, category: product.category },
          orderBy: { createdAt: "desc" },
          take: 4,
          select: PAGE_SELECT,
        })
      : Promise.resolve([]),
    prisma.product.findMany({
      where: relatedWhere,
      orderBy: { createdAt: "desc" },
      take: 8,
      select: PAGE_SELECT,
    }),
  ]);
  const seen = new Set<string>([product.id]);
  const related = [...sameCategory, ...newest]
    .filter((p) => (seen.has(p.id) ? false : (seen.add(p.id), true)))
    .slice(0, 4);

  return (
    <div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          // Escape < so DB-sourced titles/descriptions can't break out of the
          // script tag (JSON-LD XSS vector).
          __html: JSON.stringify(productJsonLd(product, price)).replace(
            /</g,
            "\\u003c"
          ),
        }}
      />

      <nav className="mb-4 text-xs text-white/40">
        <Link href="/shop" className="transition hover:text-white/70">
          ← All finds
        </Link>
        {product.category && (
          <>
            <span className="mx-2 text-white/20">/</span>
            <Link
              href={`/shop?cat=${encodeURIComponent(product.category)}`}
              className="transition hover:text-white/70"
            >
              {product.category}
            </Link>
          </>
        )}
      </nav>

      <ProductPageView
        item={{
          id: product.id,
          title: product.title,
          price,
          shipPrice: product.shipPrice,
          amazonAsin: product.amazonAsin,
          description: product.description,
          category: product.category,
          imageUrls: product.imageUrls,
          videoUrl: product.videoUrl,
          createdAt: product.createdAt,
          fbListingId: product.fbListingId,
          status: product.status,
        }}
        amazonEnabled
        amazonTag={amazonTag}
      />

      {/* Video short — embeds the product's YouTube Short when one exists */}
      {product.amazonAsin && SHORTS[product.amazonAsin] && (
        <div className="mt-6 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-4">
          <p className="mb-3 text-sm font-semibold text-white">
            ▶️ See it in action
          </p>
          <div className="mx-auto aspect-[9/16] w-full max-w-[320px] overflow-hidden rounded-lg">
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${SHORTS[product.amazonAsin].v}`}
              title={`${product.title} — video short`}
              className="h-full w-full"
              allow="accelerometer; encrypted-media; picture-in-picture"
              allowFullScreen
              loading="lazy"
            />
          </div>
        </div>
      )}

      {/* Drop list — every FB deep-link lands here; capture before they bounce */}
      <div className="mt-6 rounded-xl border border-pink-500/25 bg-pink-500/[0.06] px-4 py-4">
        <p className="text-sm font-semibold text-white">
          📦 New haul drops weekly — get first dibs
        </p>
        <p className="mt-1 text-xs text-white/55">
          One email when fresh finds land. No spam, unsubscribe anytime.
        </p>
        <EmailCaptureForm
          source="shop-drops"
          ctaText="Get the drop list"
          successMessage="You're on the list — first dibs on the next haul."
          className="mt-3 max-w-md"
        />
      </div>

      {related.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-white/60">
            More finds you might like
          </h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {related.map((p, i) => (
              <ShopCard
                key={p.id}
                item={{
                  id: p.id,
                  title: p.title,
                  price: productPrice(p),
                  shipPrice: p.shipPrice,
                  amazonAsin: p.amazonAsin,
                  description: p.description,
                  category: p.category,
                  imageUrls: p.imageUrls,
                  videoUrl: p.videoUrl,
                  createdAt: p.createdAt,
                  fbStatus: p.fbStatus,
                  fbListingId: p.fbListingId,
                }}
                delay={i * 50}
                amazonEnabled
                amazonTag={amazonTag}
              />
            ))}
          </div>
        </div>
      )}

      <div className="mt-10">
        <MoreFromTolley currentSubsite="shop" />
      </div>
    </div>
  );
}
