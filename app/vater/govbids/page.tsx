import { requireVaterAdminPageSession } from "@/lib/admin-auth";
import type { Metadata } from "next";

import { GovBidsHero } from "@/components/vater/govbids-hero";
import { GovBidsProcess } from "@/components/vater/govbids-process";
import { GovBidsRequirements } from "@/components/vater/govbids-requirements";
import { GovBidsSetup } from "@/components/vater/govbids-setup";
import { GovBidsFaq } from "@/components/vater/govbids-faq";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
  title: "GovBids | Vater Ventures",
  description:
    "Win government and military supply contracts with AI-powered bid scanning, cost calculation, and proposal generation. $700B+ market, low competition, high margins.",
};

export default async function GovBidsPage() {
  await requireVaterAdminPageSession("/vater/govbids");
  return (
    <main>
      <GovBidsHero />

      <div className="mx-auto max-w-4xl px-6 py-16">
        <GovBidsProcess />
      </div>

      <div className="mx-auto max-w-4xl px-6 py-16">
        <GovBidsRequirements />
      </div>

      <div className="mx-auto max-w-4xl px-6 py-16">
        <GovBidsSetup />
      </div>

      <div className="mx-auto max-w-4xl px-6 py-16">
        <GovBidsFaq />
      </div>
    </main>
  );
}
