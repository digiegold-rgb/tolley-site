import type { Metadata } from "next";
import Link from "next/link";
import { SiteTracker } from "@/components/analytics/site-tracker";

export const metadata: Metadata = {
  title: "Shop Her Look | tolley.io/fit",
  description:
    "Like the fit? Every outfit Ruthann wears in our videos — dresses, jeans, shoes, jewelry, hair — with real brands you can shop on Amazon.",
  alternates: { canonical: "https://www.tolley.io/fit" },
  openGraph: {
    title: "Shop Her Look · tolley.io/fit",
    description: "The exact fit from the video — brands + Amazon links.",
    url: "https://www.tolley.io/fit",
    type: "website",
  },
};

export default function FitLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#0b0b10] text-white">
      <SiteTracker site="fit" />
      <header className="border-b border-white/10 bg-gradient-to-r from-pink-500/15 via-fuchsia-500/5 to-transparent">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
          <Link href="/fit" className="flex items-center gap-2 text-lg font-bold">
            <span>👗</span> <span>Shop Her Look</span>
            <span className="hidden text-sm font-normal text-white/50 sm:inline">· tolley.io/fit</span>
          </Link>
          <nav className="flex items-center gap-4 text-sm text-white/70">
            <Link href="/shop" className="hover:text-white">🛒 Shop</Link>
            <a href="https://www.amazon.com/shop/digitaljared?tag=jaredtolley-20" target="_blank" rel="nofollow sponsored noopener" className="hover:text-white">Storefront</a>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-8">{children}</main>
    </div>
  );
}
