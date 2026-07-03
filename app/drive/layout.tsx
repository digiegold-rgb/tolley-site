import type { Metadata } from "next";
import Link from "next/link";
import { Barlow_Condensed } from "next/font/google";

import { SiteTracker } from "@/components/analytics/site-tracker";
import { LmFooter } from "@/components/lastmile/lm-footer";

import "../lastmile/lastmile.css";

const barlowCondensed = Barlow_Condensed({
  weight: ["300", "400", "500", "600", "700", "800"],
  variable: "--font-barlow-condensed",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Drive with Red Alert Dispatch | Earn 82% | Kansas City",
  description:
    "Kansas City delivery drivers: keep 82% of every delivery. No signup fees, instant pay via Stripe. AI-dispatched gig driving — better pay than Spark, Roadie, or GoShare.",
  keywords: [
    "delivery driver jobs Kansas City",
    "gig driver KC",
    "last mile driver Kansas City",
    "delivery driver sign up Kansas City",
    "Spark driver alternative KC",
    "GoShare alternative Kansas City",
    "Red Alert Dispatch driver",
    "delivery jobs Independence MO",
  ],
  openGraph: {
    title: "Drive with Red Alert Dispatch | Earn 82% Per Delivery",
    description:
      "Keep 82% of every delivery. No signup fees. KC metro only. Better than Spark, Roadie, or GoShare.",
    type: "website",
    url: "https://www.tolley.io/drive",
  },
  alternates: {
    canonical: "https://www.tolley.io/drive",
  },
  other: {
    "geo.region": "US-MO",
    "geo.placename": "Independence",
  },
};

export default function DriveLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={`lastmile-page lm-radar ${barlowCondensed.variable}`}>
      <SiteTracker site="drive" />
      <div aria-hidden="true" className="site-dot-grid-red pointer-events-none fixed inset-0 z-0" />

      {/* Minimal nav bar */}
      <nav className="relative z-20 flex items-center justify-between px-5 py-4 sm:px-8">
        <Link
          href="/drive"
          className="text-sm font-bold tracking-widest text-red-500 uppercase"
        >
          Red Alert Dispatch
        </Link>
        <div className="flex items-center gap-4 text-sm">
          <Link href="/drive/quote" className="text-gray-400 hover:text-white transition">
            Quote
          </Link>
          <Link href="/drive/register" className="text-gray-400 hover:text-white transition">
            Drive
          </Link>
          <Link href="/drive/dashboard" className="text-gray-400 hover:text-white transition">
            Dashboard
          </Link>
          <Link href="/lastmile" className="text-gray-500 hover:text-gray-300 transition">
            About
          </Link>
        </div>
      </nav>

      {children}
      <LmFooter />
    </div>
  );
}
