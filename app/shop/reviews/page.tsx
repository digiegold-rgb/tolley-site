import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import ReviewCard, {
  type ReviewCardData,
} from "@/components/shop/ReviewCard";

export const revalidate = 1800;

export const metadata: Metadata = {
  title: "Reviews | tolley.io/shop",
  description:
    "Real reviews from real Facebook Marketplace buyers. 5-star ratings on punctuality, communication, and item description.",
  alternates: { canonical: "https://www.tolley.io/shop/reviews" },
  openGraph: {
    title: "Reviews | tolley.io/shop",
    description:
      "Real buyer reviews from Facebook Marketplace and beyond.",
    url: "https://www.tolley.io/shop/reviews",
    type: "website",
  },
};

/**
 * Safe JSON-LD serializer. We sanitize the dangerous </script> sequence and
 * the HTML comment opener that could be used to break out of the <script>
 * tag context. Content here is server-built from our own DB rows, but doing
 * this defensively is cheap and avoids any future injection regression.
 */
function safeJsonLd(obj: unknown): string {
  return JSON.stringify(obj)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

export default async function ReviewsPage() {
  const reviews = await prisma.review.findMany({
    where: { hidden: false },
    orderBy: [{ displayOrder: "asc" }, { reviewedAt: "desc" }],
    include: {
      product: {
        select: { id: true, title: true, imageUrls: true },
      },
    },
    take: 500,
  });

  // Aggregate
  const ratings = reviews
    .map((r) => r.rating)
    .filter((r): r is number => typeof r === "number" && r > 0);
  const avg =
    ratings.length > 0
      ? Number((ratings.reduce((s, r) => s + r, 0) / ratings.length).toFixed(2))
      : null;

  // JSON-LD: schema.org LocalBusiness with AggregateRating + Review[]
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: "tolley.io/shop",
    url: "https://www.tolley.io/shop",
    description:
      "Furniture, electronics, home goods and more — sold from Independence, MO via Facebook Marketplace.",
    address: {
      "@type": "PostalAddress",
      addressLocality: "Independence",
      addressRegion: "MO",
      addressCountry: "US",
    },
    ...(avg !== null && ratings.length > 0
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: avg,
            reviewCount: ratings.length,
            bestRating: 5,
            worstRating: 1,
          },
        }
      : {}),
    review: reviews.slice(0, 20).map((r) => ({
      "@type": "Review",
      author: { "@type": "Person", name: r.reviewerName },
      ...(r.rating
        ? {
            reviewRating: {
              "@type": "Rating",
              ratingValue: r.rating,
              bestRating: 5,
              worstRating: 1,
            },
          }
        : {}),
      reviewBody: r.body,
      ...(r.reviewedAt
        ? { datePublished: r.reviewedAt.toISOString().slice(0, 10) }
        : {}),
    })),
  };

  if (reviews.length === 0) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center text-center">
        <p className="text-4xl">⭐</p>
        <h2 className="mt-4 text-xl font-bold text-white">
          Reviews are loading
        </h2>
        <p className="mt-2 text-sm text-white/50">
          We&rsquo;re importing buyer feedback from Facebook Marketplace.
          Check back shortly.
        </p>
        <Link
          href="/shop"
          className="shop-cta mt-6 rounded-full px-5 py-2 text-sm font-semibold text-white"
        >
          Browse the shop
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      {/* JSON-LD for Google rich results — values are escaped by safeJsonLd. */}
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }}
      />

      <header className="mb-6 text-center">
        <h1 className="text-2xl font-bold text-white sm:text-3xl">
          Buyer Reviews
        </h1>
        <p className="mt-2 text-sm text-white/60">
          Real feedback from real Marketplace buyers.
        </p>
        {avg !== null && (
          <p className="mt-3 text-sm text-white/80">
            <span className="text-amber-400">★</span>{" "}
            <span className="font-bold">{avg.toFixed(1)}</span>
            <span className="text-white/40"> avg · {ratings.length} reviews</span>
          </p>
        )}
      </header>

      <div className="flex flex-col gap-3">
        {reviews.map((r) => {
          const data: ReviewCardData = {
            id: r.id,
            reviewerName: r.reviewerName,
            reviewerAvatar: r.reviewerAvatar,
            rating: r.rating,
            body: r.body,
            notableTags: r.notableTags,
            reviewedAt: r.reviewedAt,
            sourceUrl: r.sourceUrl,
            source: r.source,
            product: r.product
              ? {
                  id: r.product.id,
                  title: r.product.title,
                  imageUrls: r.product.imageUrls,
                }
              : null,
          };
          return <ReviewCard key={r.id} review={data} />;
        })}
      </div>
    </div>
  );
}
