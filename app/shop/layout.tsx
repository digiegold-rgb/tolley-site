import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { FACEBOOK_PROFILE_URL } from "@/lib/shop";
import { SiteTracker } from "@/components/analytics/site-tracker";
import "./shop.css";

export const metadata: Metadata = {
  title: "Shop | tolley.io",
  description:
    "Browse furniture, electronics, home goods & more. New items daily. Message on Facebook to buy.",
  openGraph: {
    title: "tolley.io/shop",
    description: "Browse & buy — new items daily",
    url: "https://www.tolley.io/shop",
    type: "website",
  },
};

async function getActiveCount(): Promise<number> {
  try {
    // Try Product model first
    const productCount = await prisma.platformListing.count({
      where: { platform: "shop", status: "active" },
    });
    if (productCount > 0) return productCount;
    // Fallback to ShopItem
    return await prisma.shopItem.count({ where: { status: "active" } });
  } catch {
    return 0;
  }
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
  const [count, admin] = await Promise.all([getActiveCount(), isAdmin()]);

  return (
    <div className="shop-page">
      <SiteTracker site="shop" />
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
              href={FACEBOOK_PROFILE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="shop-cta rounded-full px-3 py-1.5 text-xs font-semibold text-white"
            >
              Message on Facebook
            </a>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>

      {/* Footer */}
      <footer className="border-t border-white/8 px-4 py-6 text-center">
        <div className="mx-auto max-w-5xl">
          <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-white/40">
            <a
              href={FACEBOOK_PROFILE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="transition hover:text-white/70"
            >
              Facebook
            </a>
            <span className="text-white/20">|</span>
            <Link href="/start" className="transition hover:text-white/70">
              All Services
            </Link>
            <span className="text-white/20">|</span>
            <Link href="/" className="transition hover:text-white/70">
              tolley.io
            </Link>
          </div>
          <p className="mt-2 text-[0.65rem] text-white/25">
            &copy; {new Date().getFullYear()} tolley.io
          </p>
        </div>
      </footer>
    </div>
  );
}
