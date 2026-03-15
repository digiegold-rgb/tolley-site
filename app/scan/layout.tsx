import type { Metadata } from "next";
import { Russo_One } from "next/font/google";
import { SiteTracker } from "@/components/analytics/site-tracker";
import "./scan.css";

const russoOne = Russo_One({
  weight: "400",
  variable: "--font-russo",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Scan Command Center | Tolley.io",
  description:
    "24/7 autonomous scanning dashboard — leads, arbitrage, products, unclaimed funds, and market intel.",
};

export default function ScanLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={`scan-page scan-texture ${russoOne.variable}`}>
      <SiteTracker site="scan" />
      {children}
    </div>
  );
}
