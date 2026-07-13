import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { TREASURE_HAUL_FB_URL, TREASURE_HAUL_MESSENGER_URL } from "@/lib/shop";
import { SiteTracker } from "@/components/analytics/site-tracker";
import ShopTabs from "@/components/shop/ShopTabs";
import TreasureHaulBanner from "@/components/shop/TreasureHaulBanner";
import AmazonStorefrontBanner from "@/components/shop/AmazonStorefrontBanner";
import Script from "next/script";
import "./shop.css";

const ONELINK_INSTANCE_ID = process.env.AMAZON_ONELINK_INSTANCE_ID;

export const metadata: Metadata = {
  title: "Shop | tolley.io",
  description:
    "Browse furniture, electronics, home goods & more. New items daily. Message on Facebook to buy.",
  keywords: [
    "online shop Independence MO",
    "buy furniture Kansas City",
    "used furniture Kansas City",
    "home goods for sale KC",
    "electronics for sale Kansas City",
    "liquidation items Kansas City",
    "resale shop KC",
  ],
  openGraph: {
    title: "tolley.io/shop",
    description: "Browse & buy — new items daily",
    url: "https://www.tolley.io/shop",
    type: "website",
    images: [
      {
        url: "/branding/ruthanns-treasure-haul/og-card.png",
        width: 1200,
        height: 630,
        alt: "Ruthann's Treasure Haul · tolley.io/shop",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "tolley.io/shop",
    description: "Browse & buy — new items daily",
    images: ["/branding/ruthanns-treasure-haul/og-card.png"],
  },
  alternates: {
    canonical: "https://www.tolley.io/shop",
  },
  other: {
    "geo.region": "US-MO",
    "geo.placename": "Independence",
  },
};

interface TabCounts {
  all: number;
  sold: number;
  videos: number;
  reviews: number;
}

async function getActiveCount(): Promise<number> {
  try {
    // Match /shop page filter exactly — only count products that will
    // actually render (status=listed, has shop listing, has at least one photo).
    const productCount = await prisma.product.count({
      where: {
        status: "listed",
        listings: { some: { platform: "shop", status: "active" } },
        imageUrls: { isEmpty: false },
      },
    });
    if (productCount > 0) return productCount;
    // Fallback to ShopItem
    return await prisma.shopItem.count({ where: { status: "active" } });
  } catch {
    return 0;
  }
}

async function getTabCounts(): Promise<TabCounts> {
  // Run all four counts in parallel. Each is wrapped so a single missing
  // table (e.g. on a brand-new env without Review) doesn't blow up the layout.
  const [all, sold, videos, reviews] = await Promise.all([
    getActiveCount(),
    prisma.product
      .count({ where: { status: "sold", imageUrls: { isEmpty: false } } })
      .catch(() => 0),
    prisma.product
      .count({
        where: {
          videoUrl: { not: null },
          status: { in: ["listed", "sold"] },
        },
      })
      .catch(() => 0),
    prisma.review
      .count({ where: { hidden: false } })
      .catch(() => 0),
  ]);
  return { all, sold, videos, reviews };
}

async function isAdmin(): Promise<boolean> {
  try {
    const cookieStore = await cookies();
    return !!cookieStore.get("shop_admin");
  } catch {
    return false;
  }
}

export default async function ShopLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [counts, admin] = await Promise.all([getTabCounts(), isAdmin()]);
  const { all: count } = counts;

  return (
    <div className="shop-page">
      <SiteTracker site="shop" />
      {ONELINK_INSTANCE_ID && (
        <Script
          id="amazon-onelink"
          strategy="afterInteractive"
          src={`https://z-na.amazon-adsystem.com/widgets/onejs?MarketPlace=US&adInstanceId=${encodeURIComponent(
            ONELINK_INSTANCE_ID
          )}`}
        />
      )}
      <div aria-hidden="true" className="site-dot-grid-purple pointer-events-none fixed inset-0 z-0" />
      {/* Header */}
      <header className="shop-header sticky top-0 z-50 px-4 py-3">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <Link href="/shop" className="flex items-center gap-2">
            <span className="text-lg font-bold tracking-tight text-white">
              tolley
              <span className="bg-gradient-to-r from-purple-400 to-violet-400 bg-clip-text text-transparent">
                .io
              </span>
              <span className="text-white/50">/shop</span>
            </span>
          </Link>
          <div className="flex items-center gap-3">
            {count > 0 && (
              <span className="shop-badge rounded-full px-2.5 py-0.5 text-xs font-medium text-purple-300">
                {count} item{count !== 1 ? "s" : ""}
              </span>
            )}
            {admin && (
              <Link
                href="/shop/dashboard"
                className="rounded-full border border-purple-500/30 bg-purple-500/10 px-3 py-1.5 text-xs font-medium text-purple-300 transition hover:bg-purple-500/20"
              >
                Dashboard
              </Link>
            )}
            <a
              href={TREASURE_HAUL_MESSENGER_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="shop-cta rounded-full px-3 py-1.5 text-xs font-semibold text-white"
            >
              Message on Facebook
            </a>
          </div>
        </div>
      </header>

      {/* Amazon storefront banner — dismissible, 14-day re-show */}
      <AmazonStorefrontBanner />

      {/* Treasure Haul brand banner — dismissible, 30-day re-show */}
      <TreasureHaulBanner />

      {/* Section tabs (top — sticky under header) */}
      <ShopTabs position="top" counts={counts} />

      {/* Content */}
      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>

      {/* Section tabs (bottom — static) */}
      <ShopTabs position="bottom" counts={counts} />

      {/* Footer */}
      <footer className="border-t border-white/8 px-4 py-6 text-center">
        <div className="mx-auto max-w-5xl">
          <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-white/40">
            <a
              href={TREASURE_HAUL_FB_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="transition hover:text-white/70"
            >
              Facebook
            </a>
            <span className="text-white/20">|</span>
            <Link href="/about" className="transition hover:text-white/70">
              About
            </Link>
            <span className="text-white/20">|</span>
            <a
              href="https://www.amazon.com/shop/digitaljared"
              target="_blank"
              rel="nofollow sponsored noopener noreferrer"
              className="transition hover:text-white/70"
            >
              Amazon Picks
            </a>
            <span className="text-white/20">|</span>
            <Link href="/shop/disclosure" className="transition hover:text-white/70">
              Disclosure
            </Link>
            <span className="text-white/20">|</span>
            <Link href="/privacy" className="transition hover:text-white/70">
              Privacy
            </Link>
            <span className="text-white/20">|</span>
            <Link href="/terms" className="transition hover:text-white/70">
              Terms
            </Link>
            <span className="text-white/20">|</span>
            <Link href="/circle" className="transition hover:text-white/70">
              The Circle
            </Link>
            <span className="text-white/20">|</span>
            <Link href="/start" className="transition hover:text-white/70">
              All Services
            </Link>
          </div>
          <p className="mt-3 text-[0.7rem] leading-relaxed text-white/35">
            As an Amazon Associate I earn from qualifying purchases. Some links on this
            site are affiliate links — when you buy through them, we may earn a
            commission at no extra cost to you.{" "}
            <Link href="/shop/disclosure" className="underline hover:text-white/60">
              Read the full disclosure
            </Link>
            .
          </p>
          <p className="mt-3 text-[0.65rem] text-white/25">
            &copy; {new Date().getFullYear()} tolley.io · Independence, MO
          </p>
        </div>
      </footer>
    </div>
  );
}
