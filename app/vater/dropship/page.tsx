import type { Metadata } from "next";

import { DropshipArbitrage } from "@/components/vater/dropship-arbitrage";
import { DropshipFaq } from "@/components/vater/dropship-faq";
import { DropshipHero } from "@/components/vater/dropship-hero";
import { DropshipHow } from "@/components/vater/dropship-how";
import { DropshipPipeline } from "@/components/vater/dropship-pipeline";
import { DropshipSetup } from "@/components/vater/dropship-setup";

export const metadata: Metadata = {
  title: "Dropship | Amazon to eBay Arbitrage — Vater Ventures",
  description:
    "AI-powered Amazon-to-eBay dropshipping. Scan price gaps, auto-list at markup, fulfill direct. Zero inventory arbitrage automated.",
};

export default function DropshipPage() {
  return (
    <main>
      <DropshipHero />
      <DropshipHow />
      <DropshipPipeline />
      <DropshipArbitrage />
      <DropshipSetup />
      <DropshipFaq />
    </main>
  );
}
