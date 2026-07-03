import type { Metadata } from "next";
import { Poppins } from "next/font/google";

import { HomesFooter } from "@/components/homes/homes-footer";
import { SiteTracker } from "@/components/analytics/site-tracker";
import "./homes.css";

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["300", "400", "600", "700", "800", "900"],
});

export const metadata: Metadata = {
  title: "Find Your Next Home | Jared Tolley — Your KC Homes LLC",
  description:
    "Kansas City real estate agent — buying, selling, and investment properties. Jared Tolley, Your KC Homes LLC, United Real Estate Kansas City.",
  keywords: [
    "Kansas City real estate agent",
    "homes for sale Independence MO",
    "Kansas City homes for sale",
    "real estate agent Independence Missouri",
    "buy house Kansas City",
    "sell house Kansas City",
    "Your KC Homes LLC",
    "Jared Tolley realtor",
  ],
  openGraph: {
    title: "Find Your Next Home | Jared Tolley",
    description:
      "Kansas City metro real estate. Buy, sell, or invest with a local expert backed by AI-powered tools.",
    type: "website",
    url: "https://www.tolley.io/homes",
  },
  alternates: {
    canonical: "https://www.tolley.io/homes",
  },
  other: {
    "geo.region": "US-MO",
    "geo.placename": "Independence",
  },
};

export default function HomesLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`homes-page homes-grid ${poppins.variable}`}>
      <SiteTracker site="homes" />
      <div aria-hidden="true" className="site-dot-grid-sky pointer-events-none fixed inset-0 z-0" />
      {children}
      <HomesFooter />
    </div>
  );
}
