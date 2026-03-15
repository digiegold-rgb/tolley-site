import type { Metadata } from "next";
import { Fredoka } from "next/font/google";

import { WdBubbles } from "@/components/wd/wd-bubbles";
import { SiteTracker, EventTracker } from "@/components/analytics/site-tracker";
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
    "Affordable washer and dryer rentals in Kansas City. Free delivery and installation, maintenance included, no contracts. Serving Independence, Lee's Summit, Blue Springs, and the KC metro. Starting at $42/mo.",
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
    "washer dryer rental Overland Park",
  ],
  openGraph: {
    title: "Washer & Dryer Rental | Free Delivery | Kansas City Metro",
    description:
      "Skip the laundromat. Washer and dryer rentals with free delivery, maintenance included, and no contracts. Serving the entire KC metro.",
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
      <SiteTracker site="wd" />
      <GA4 />
      <MetaPixel />
      <EventTracker site="wd">
        <WdBubbles />
        {children}
        <WdFooter />
        <WdEmailBar />
      </EventTracker>
    </div>
  );
}
