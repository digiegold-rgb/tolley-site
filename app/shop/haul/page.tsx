import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import ShopCard, { type ShopCardItem } from "@/components/shop/ShopCard";

export const revalidate = 600;

export const metadata: Metadata = {
  title: "Amazon Haul — Everything Under $20 | tolley.io/shop",
  description:
    "Hand-picked Amazon Haul finds — every item under $20 and eligible for Amazon's first-purchase bounty. Curated by Ruthann.",
  alternates: { canonical: "https://www.tolley.io/shop/haul" },
  openGraph: {
    title: "Amazon Haul — Everything Under $20",
    description:
      "Hand-picked Amazon Haul finds, all under $20. As an Amazon Associate, qualifying purchases earn a commission.",
    url: "https://www.tolley.io/shop/haul",
    type: "website",
  },
};

const PAGE_SIZE = 48;

export default async function HaulPage() {
  const [rawProducts, total] = await Promise.all([
    prisma.product.findMany({
      where: {
        haulEligible: true,
        imageUrls: { isEmpty: false },
        amazonAsin: { not: null },
      },
      include: {
        listings: { where: { platform: "shop" }, take: 1, select: { price: true } },
      },
      orderBy: [
        { amazonClicks: "desc" },
        { haulPromotedAt: { sort: "asc", nulls: "first" } },
      ],
      take: PAGE_SIZE,
    }),
    prisma.product.count({ where: { haulEligible: true } }),
  ]);

  const products: ShopCardItem[] = rawProducts.map((p) => ({
    ...p,
    price: p.listings[0]?.price ?? p.targetPrice ?? 0,
  }));

  const amazonTag = process.env.AMAZON_HAUL_TAG || process.env.AMAZON_AFFILIATE_TAG || "tolley-shop-20";

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-8 rounded-xl border border-orange-500/30 bg-orange-500/5 p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-orange-400">
              🛒 Amazon Haul — Everything Under $20
            </h1>
            <p className="mt-1 text-sm text-white/60">
              {total} hand-picked finds, all under $20. Amazon may award a one-time first-purchase bounty on Haul orders — same Prime shipping you already love.
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              href="https://www.amazon.com/shop/digitaljared"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg bg-orange-500/10 border border-orange-500/40 px-4 py-2 text-sm font-medium text-orange-300 hover:bg-orange-500/20"
            >
              Full Storefront →
            </Link>
            <Link
              href="/shop"
              className="rounded-lg border border-white/10 px-4 py-2 text-sm text-white/60 hover:bg-white/5"
            >
              All of /shop
            </Link>
          </div>
        </div>
      </div>

      {products.length === 0 ? (
        <div className="flex min-h-[30vh] flex-col items-center justify-center text-center">
          <p className="text-4xl">🛒</p>
          <p className="mt-3 text-white/70">
            No Haul-eligible items right now. Check back tomorrow — the catalog re-flags nightly.
          </p>
          <Link href="/shop" className="mt-4 text-sm text-orange-400 hover:underline">
            Browse the full shop →
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {products.map((p, i) => (
            <ShopCard
              key={p.id}
              item={p}
              delay={Math.min(i, 5) * 50}
              amazonTag={amazonTag}
            />
          ))}
        </div>
      )}

      <div className="mt-12 rounded-lg border border-white/10 bg-white/[0.02] p-4 text-xs text-white/50">
        <p>
          <strong>FTC Disclosure:</strong> As an Amazon Associate, tolley.io earns from qualifying purchases. Amazon Haul orders may also award a one-time $4 bounty on a new customer's first Haul purchase, in addition to standard commission. Prices and availability change frequently — check the Amazon listing for the latest. See our{" "}
          <Link href="/shop/disclosure" className="text-orange-400 hover:underline">
            full disclosure
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
