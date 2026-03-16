"use client";

import { useState } from "react";
import { TrendCards } from "@/components/shop/TrendCards";
import { CompsPanel } from "@/components/shop/CompsPanel";
import { ProfitCalculator } from "@/components/shop/ProfitCalculator";
import { ScanProgress } from "@/components/shop/ScanProgress";

export default function TrendsPage() {
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div>
      <h1 className="text-xl font-bold text-white">Trend Discovery</h1>
      <p className="mt-1 text-sm text-white/40">
        Turbo scanner — 60+ unconventional sources, AI cross-reference
      </p>

      {/* Scanner control + live progress */}
      <div className="mt-4">
        <ScanProgress onComplete={() => setRefreshKey((k) => k + 1)} />
      </div>

      {/* What we scan */}
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-6">
        {[
          { icon: "🔍", label: "Niche eBay", sub: "20+ categories" },
          { icon: "📈", label: "Google Trends", sub: "Rising searches" },
          { icon: "💬", label: "Reddit", sub: "r/Flipping intel" },
          { icon: "🏛️", label: "Gov Surplus", sub: "GovDeals + GSA" },
          { icon: "🏪", label: "Goodwill", sub: "ShopGoodwill.com" },
          { icon: "🤖", label: "AI Synthesis", sub: "Cross-reference" },
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-lg border border-white/8 bg-white/[0.02] p-2.5 text-center"
          >
            <p className="text-lg">{s.icon}</p>
            <p className="text-[0.65rem] font-medium text-white/50">{s.label}</p>
            <p className="text-[0.55rem] text-white/20">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Active trend signals */}
      <div className="mt-6" key={refreshKey}>
        <TrendCards />
      </div>

      {/* Tools */}
      <div className="mt-8 grid gap-6 md:grid-cols-2">
        <div>
          <h2 className="mb-3 text-sm font-semibold text-white/60">
            Quick Comp Lookup
          </h2>
          <CompsPanel />
        </div>
        <div>
          <h2 className="mb-3 text-sm font-semibold text-white/60">
            Profit Calculator
          </h2>
          <ProfitCalculator />
        </div>
      </div>
    </div>
  );
}
