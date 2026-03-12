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
  openGraph: {
    title: "Vater Ventures | Five Runways. One Mission.",
    description:
      "Five AI-powered passive-income businesses — dropshipping, print-on-demand, government contracts, faceless YouTube, and digital courses.",
    type: "website",
  },
};

export default function VaterLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`vater-page ${rajdhani.variable}`}>
      <VaterContrails />
      {children}
      <VaterFooter />
    </div>
  );
}
