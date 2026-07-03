import type { Metadata } from "next";
import { Rajdhani } from "next/font/google";

import { VaterContrails } from "@/components/vater/vater-contrails";
import { VaterFooter } from "@/components/vater/vater-footer";
import "./vater.css";

const rajdhani = Rajdhani({
  variable: "--font-rajdhani",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Vater Ventures | Five Runways. One Mission.",
  description:
    "Five AI-powered passive-income businesses built for a pilot who thinks in flight plans. Dropship, Merch, GovBids, YouTube, and Digital Courses.",
  keywords: [
    "passive income AI business",
    "AI dropshipping",
    "print on demand business",
    "government contracts small business",
    "faceless YouTube channel",
    "digital courses online",
    "AI powered business ideas",
    "Vater Ventures",
  ],
  openGraph: {
    title: "Vater Ventures | Five Runways. One Mission.",
    description:
      "Five AI-powered passive-income businesses — dropshipping, print-on-demand, government contracts, faceless YouTube, and digital courses.",
    type: "website",
    url: "https://www.tolley.io/vater",
  },
  alternates: {
    canonical: "https://www.tolley.io/vater",
  },
};

export default function VaterLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`vater-page ${rajdhani.variable}`}>
      <VaterContrails />
      <div aria-hidden="true" className="site-dot-grid-sky pointer-events-none fixed inset-0 z-0" />
      {children}
      <VaterFooter />
    </div>
  );
}
