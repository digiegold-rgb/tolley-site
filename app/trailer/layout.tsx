import type { Metadata } from "next";
import { Oswald } from "next/font/google";

import { TrailerFooter } from "@/components/trailer/trailer-footer";
import { SiteTracker } from "@/components/analytics/site-tracker";
import { GA4 } from "@/components/analytics/ga4";
import { MetaPixel } from "@/components/analytics/meta-pixel";
import "./trailer.css";

const oswald = Oswald({
  variable: "--font-oswald",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Trailer Rental | Your KC Homes LLC",
  description:
    "Utility trailer rentals in Independence, MO. 18ft and 20ft trailers, 7,000 lb capacity. No plates needed. All payments accepted. Message us on Facebook.",
  keywords: [
    "trailer rental Kansas City",
    "utility trailer rental Independence MO",
    "trailer rental near me",
    "cheap trailer rental KC",
    "20ft trailer rental Kansas City",
    "car hauler rental KC",
    "trailer rental Independence Missouri",
  ],
  openGraph: {
    title: "Trailer Rental | Your KC Homes LLC",
    description:
      "Rent a trailer. Get it done. Heavy-duty utility trailers in Kansas City. No plates, no hassle. Message us on Facebook.",
    type: "website",
    url: "https://www.tolley.io/trailer",
  },
  alternates: {
    canonical: "https://www.tolley.io/trailer",
  },
  other: {
    "geo.region": "US-MO",
    "geo.placename": "Independence",
  },
};

export default function TrailerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`trailer-page trailer-grit ${oswald.variable}`}>
      <SiteTracker site="trailer" />
      <GA4 />
      <MetaPixel />
      <div aria-hidden="true" className="site-dot-grid-amber pointer-events-none fixed inset-0 z-0" />
      {children}
      <TrailerFooter />
    </div>
  );
}
