import type { Metadata } from "next";
import { Outfit } from "next/font/google";

import { TablesFooter } from "@/components/tables/tables-footer";
import { SiteTracker } from "@/components/analytics/site-tracker";
import { GA4 } from "@/components/analytics/ga4";
import { MetaPixel } from "@/components/analytics/meta-pixel";
import "./tables.css";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Tables & Chairs Rental | Your KC Homes LLC",
  description:
    "Rent folding tables and chairs in Independence, MO. Round, 6ft, 8ft, and 4ft adjustable tables — $5/day each. Chairs $5/day. Bundle deals available. $30 deposit. Delivery $2/mile.",
  openGraph: {
    title: "Tables & Chairs Rental | Your KC Homes LLC",
    description:
      "Folding tables & chairs for parties, events, and gatherings. From $5/day. Kansas City area delivery available.",
    type: "website",
  },
};

export default function TablesLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`tables-page tbl-weave ${outfit.variable}`}>
      <SiteTracker site="tables" />
      <GA4 />
      <MetaPixel />
      {children}
      <TablesFooter />
    </div>
  );
}
