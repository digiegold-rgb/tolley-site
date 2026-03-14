import type { Metadata } from "next";
import { Nunito } from "next/font/google";

import { SiteTracker } from "@/components/analytics/site-tracker";
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
  openGraph: {
    title: "Pool Supplies, Delivered | Your KC Homes LLC",
    description:
      "Contractor pricing on pool chemicals, equipment & accessories. KC metro delivery included. No membership required.",
    type: "website",
  },
};

export default function PoolsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`pools-page ${nunito.variable}`}>
      <SiteTracker site="pools" />
      {children}
      <PoolsFooter />
    </div>
  );
}
