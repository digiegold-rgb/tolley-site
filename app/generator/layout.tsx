import type { Metadata } from "next";
import { Exo_2 } from "next/font/google";

import { GeneratorFooter } from "@/components/generator/generator-footer";
import { SiteTracker } from "@/components/analytics/site-tracker";
import { GA4 } from "@/components/analytics/ga4";
import { MetaPixel } from "@/components/analytics/meta-pixel";
import "./generator.css";

const exo2 = Exo_2({
  variable: "--font-exo2",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Generator Rental | Your KC Homes LLC",
  description:
    "Tri-fuel generator rental in Independence, MO. 9,400W starting watts — gasoline, propane, or natural gas. Perfect for parties, bounce houses, power outages, and job sites. Call to book.",
  keywords: [
    "generator rental Kansas City",
    "generator rental Independence MO",
    "bounce house generator rental KC",
    "portable generator rental near me",
    "tri-fuel generator rental",
    "party generator rental Kansas City",
    "power outage generator rental KC",
  ],
  openGraph: {
    title: "Generator Rental | Your KC Homes LLC",
    description:
      "Power anything, anywhere. Tri-fuel 9,400W generator rental in Kansas City. Bounce houses, events, emergencies. Call to reserve.",
    type: "website",
    url: "https://www.tolley.io/generator",
  },
  alternates: {
    canonical: "https://www.tolley.io/generator",
  },
  other: {
    "geo.region": "US-MO",
    "geo.placename": "Independence",
  },
};

export default function GeneratorLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`generator-page gen-circuit ${exo2.variable}`}>
      <SiteTracker site="generator" />
      <GA4 />
      <MetaPixel />
      <div aria-hidden="true" className="site-dot-grid-yellow pointer-events-none fixed inset-0 z-0" />
      {children}
      <GeneratorFooter />
    </div>
  );
}
