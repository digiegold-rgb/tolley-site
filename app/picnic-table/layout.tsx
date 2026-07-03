import type { Metadata } from "next";
import { Nunito } from "next/font/google";

import { PicnicFooter } from "@/components/picnic-table/picnic-footer";
import { SiteTracker } from "@/components/analytics/site-tracker";
import { GA4 } from "@/components/analytics/ga4";
import { MetaPixel } from "@/components/analytics/meta-pixel";
import "./picnic-table.css";

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Picnic Table Rental | Your KC Homes LLC",
  description:
    "Rent a folding picnic table in Independence, MO. $28/day with $30 deposit. Perfect for cookouts, parties, and outdoor events. Delivery available at $2/mile.",
  openGraph: {
    title: "Picnic Table Rental | Your KC Homes LLC",
    description:
      "Folding picnic table rental — $28/day. Kansas City area delivery available.",
    type: "website",
  },
};

export default function PicnicTableLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`picnic-page pt-dots ${nunito.variable}`}>
      <SiteTracker site="picnic-table" />
      <GA4 />
      <MetaPixel />
      {children}
      <PicnicFooter />
    </div>
  );
}
