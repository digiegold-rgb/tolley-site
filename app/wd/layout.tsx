import type { Metadata } from "next";
import { Fredoka } from "next/font/google";

import { WdBubbles } from "@/components/wd/wd-bubbles";
import { EventTracker } from "@/components/analytics/site-tracker";
import { GA4 } from "@/components/analytics/ga4";
import { MetaPixel } from "@/components/analytics/meta-pixel";
import { WdFooter } from "@/components/wd/wd-footer";
import { WdEmailBar } from "@/components/wd/wd-email-bar";
import "./wd.css";

const fredoka = Fredoka({
  variable: "--font-fredoka",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Washer & Dryer Rental Kansas City | Free Delivery | Your KC Homes LLC",
  description:
    "Washer and dryer rentals within about 25 minutes of Independence, MO. Free delivery and installation, maintenance included, no contracts. $42/mo washer or $58/mo bundle.",
  keywords: [
    "washer dryer rental Kansas City",
    "washer rental KC",
    "dryer rental Kansas City",
    "appliance rental Independence MO",
    "washer dryer rental near me",
    "monthly washer dryer rental",
    "laundry rental Kansas City",
    "washer rental Lee's Summit",
    "appliance rental Blue Springs",
    "washer dryer rental Independence MO",
  ],
  openGraph: {
    title: "Washer & Dryer Rental | Free Delivery | Independence, MO",
    description:
      "Skip the laundromat. Washer and dryer rentals with free delivery and maintenance included. We deliver within about 25 minutes of Independence, MO.",
    type: "website",
    url: "https://www.tolley.io/wd",
    images: [{ url: "/wd/opengraph-image", width: 1200, height: 630 }],
  },
  alternates: {
    canonical: "https://www.tolley.io/wd",
  },
  other: {
    "geo.region": "US-MO",
    "geo.placename": "Kansas City",
  },
};

export default function WdLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`wd-page ${fredoka.variable}`}>
      <GA4 />
      <MetaPixel />
      <EventTracker site="wd">
        <WdBubbles />
        <div aria-hidden="true" className="site-dot-grid-blue pointer-events-none fixed inset-0 z-0" />
        {children}
        <WdEmailBar />
        <WdFooter />
      </EventTracker>
    </div>
  );
}
