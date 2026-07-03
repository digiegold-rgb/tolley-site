import type { Metadata } from "next";
import { Nunito } from "next/font/google";

import { SiteTracker } from "@/components/analytics/site-tracker";
import "./crazybins.css";

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
  weight: ["400", "600", "700", "800", "900"],
});

export const metadata: Metadata = {
  title: "Crazy Bin Store #2 — Liquidation Deals in Independence, MO",
  description:
    "Independence's favorite liquidation/bin store. Electronics, appliances, toys, tools — 60–80% off retail. Different deal every day at 4452 S Noland Rd.",
  keywords: [
    "Crazy Bin Store",
    "bin store Independence MO",
    "liquidation store Independence",
    "discount store Noland Road",
    "$12 Friday Independence",
    "tienda de liquidación Independence",
    "Kansas City bin store",
  ],
  openGraph: {
    title: "Crazy Bin Store #2 — Liquidation Deals Every Day",
    description:
      "Electronics, appliances, toys, tools — 60–80% off retail. Open 6 days at 4452 S Noland Rd, Independence, MO. Closed Thursdays for restock.",
    type: "website",
    url: "https://www.tolley.io/crazybins",
    images: [{ url: "https://www.tolley.io/crazybins/og.jpg", width: 1200, height: 630, alt: "Crazy Bin Store #2 — Liquidation Deals Every Day" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Crazy Bin Store #2 — Liquidation Deals Every Day",
    description:
      "Electronics, appliances, toys, tools — 60–80% off retail. Open 6 days at 4452 S Noland Rd, Independence, MO. Closed Thursdays for restock.",
    images: ["https://www.tolley.io/crazybins/og.jpg"],
  },
  icons: {
    icon: [{ url: "/crazybins/icon.png", sizes: "512x512", type: "image/png" }],
    apple: [{ url: "/crazybins/apple-icon.png", sizes: "180x180", type: "image/png" }],
  },
  alternates: { canonical: "https://www.tolley.io/crazybins" },
  other: {
    "geo.region": "US-MO",
    "geo.placename": "Independence",
    "geo.position": "39.041667;-94.366111",
    ICBM: "39.041667, -94.366111",
  },
};

export default function CrazybinsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`crazybins-page ${nunito.variable}`}>
      <SiteTracker site="crazybins" />
      {children}
    </div>
  );
}
