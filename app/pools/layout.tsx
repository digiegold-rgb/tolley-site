import type { Metadata } from "next";
import { Nunito } from "next/font/google";

import { SiteTracker } from "@/components/analytics/site-tracker";
import { PoolsCartProvider } from "@/components/pools/pools-cart-provider";
import { PoolsCartDrawer } from "@/components/pools/pools-cart-drawer";
import { PoolsFooter } from "@/components/pools/pools-footer";
import "./pools.css";

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Pool Supplies, Delivered | Your KC Homes LLC",
  description:
    "Pool supplies at contractor pricing, delivered to your door in Kansas City. Beat Walmart and Leslie's prices — no membership required.",
  keywords: [
    "pool supplies Kansas City",
    "pool chemicals delivery KC",
    "pool supply delivery Independence MO",
    "cheap pool chemicals Kansas City",
    "pool supply store near me",
    "Pool Corp contractor pricing",
    "pool chemical delivery Kansas City",
  ],
  openGraph: {
    title: "Pool Supplies, Delivered | Your KC Homes LLC",
    description:
      "Contractor pricing on pool chemicals, equipment & accessories. KC metro delivery included. No membership required.",
    type: "website",
    url: "https://www.tolley.io/pools",
  },
  alternates: {
    canonical: "https://www.tolley.io/pools",
  },
  other: {
    "geo.region": "US-MO",
    "geo.placename": "Kansas City",
  },
};

export default function PoolsLayout({ children }: { children: React.ReactNode }) {
  return (
    <PoolsCartProvider>
      <div className={`pools-page ${nunito.variable}`}>
        <SiteTracker site="pools" />
        <div aria-hidden="true" className="site-dot-grid-cyan pointer-events-none fixed inset-0 z-0" />
        {children}
        <PoolsFooter />
        <PoolsCartDrawer />
      </div>
    </PoolsCartProvider>
  );
}
