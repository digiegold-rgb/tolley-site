import type { Metadata } from "next";
import { Barlow_Condensed } from "next/font/google";

import { LmFooter } from "@/components/lastmile/lm-footer";
import { SiteTracker } from "@/components/analytics/site-tracker";
import { LmStreaks } from "@/components/lastmile/lm-streaks";

import "./lastmile.css";

const barlowCondensed = Barlow_Condensed({
  weight: ["300", "400", "500", "600", "700", "800"],
  variable: "--font-barlow-condensed",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Red Alert Dispatch | Last-Mile Delivery | Independence, MO",
  description:
    "Fast last-mile delivery for contractors & businesses in Kansas City. 3,000+ deliveries, 8 vehicles & trailers up to 10,000 lbs. Starting at $2/mile.",
  openGraph: {
    title: "Red Alert Dispatch — Fast. Done.",
    description:
      "Last-mile delivery for contractors & businesses. Kansas City metro. Starting at $2/mile.",
    url: "https://www.tolley.io/lastmile",
    type: "website",
  },
};

export default function LastmileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={`lastmile-page lm-radar ${barlowCondensed.variable}`}>
      <SiteTracker site="lastmile" />
      <LmStreaks />
      {children}
      <LmFooter />
    </div>
  );
}
