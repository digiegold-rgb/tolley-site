"use client";

import { AffiliateManager } from "@/components/shop/AffiliateManager";
import { AffiliateStatsCard } from "@/components/shop/AffiliateStatsCard";

export default function AffiliatesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Affiliates</h1>
        <p className="mt-1 text-sm text-white/40">
          Click stats from our side. Amazon Associates dashboard data is queued
          as a follow-up scraper. Manage shortlinks below — share via{" "}
          <code className="text-white/60">tolley.io/go/CODE</code>.
        </p>
      </div>

      <AffiliateStatsCard />

      <div>
        <h2 className="mb-3 text-base font-semibold text-white/85">Manage links</h2>
        <AffiliateManager />
      </div>
    </div>
  );
}
