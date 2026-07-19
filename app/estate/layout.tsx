import type { Metadata } from "next";
import { Fraunces } from "next/font/google";
import { SiteTracker } from "@/components/analytics/site-tracker";
import "./estate.css";

const fraunces = Fraunces({
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-fraunces",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Tolley Estate Sales — Boutique Estate Sale Company in Independence, MO",
  description:
    "Independence's boutique, family-run estate sale company. Free walkthrough, zero upfront cost, every form of payment, a contract you can read online first — and an itemized settlement fast. Our first sale grossed $5,000+ in one weekend. Call/text 913-283-3826.",
  keywords: [
    "estate sale company Independence MO",
    "estate sales Kansas City",
    "estate sale company KC",
    "estate liquidation Independence",
    "downsizing help Kansas City",
    "estate sale this weekend Kansas City",
  ],
  openGraph: {
    title: "Tolley Estate Sales — Independence, MO",
    description:
      "Boutique full-service estate sales: free walkthrough, zero upfront, real marketing, fast settlement. $5,000+ first sale — now booking.",
    type: "website",
    url: "https://www.tolley.io/estate",
  },
  alternates: { canonical: "https://www.tolley.io/estate" },
  other: {
    "geo.region": "US-MO",
    "geo.placename": "Independence",
  },
};

export default function EstateLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`estate-page ${fraunces.variable}`}>
      <SiteTracker site="estate" />
      {children}
    </div>
  );
}
