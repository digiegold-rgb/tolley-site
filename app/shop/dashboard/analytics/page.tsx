"use client";

import { useState } from "react";
import { RevenueChart } from "@/components/shop/RevenueChart";
import { PlatformCompare } from "@/components/shop/PlatformCompare";
import { VisitorAnalytics } from "@/components/shop/VisitorAnalytics";
import { ImportedRevenue } from "@/components/shop/ImportedRevenue";
import { EcosystemHealth } from "@/components/shop/EcosystemHealth";
import { ClickQualityCard } from "@/components/shop/ClickQualityCard";
import Link from "next/link";

type Tab = "visitors" | "revenue";

export default function AnalyticsPage() {
  const [days, setDays] = useState(30);
  const [tab, setTab] = useState<Tab>("visitors");

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-white">Analytics</h1>
        <div className="flex gap-2">
          {[7, 14, 30, 90].map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                days === d
                  ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                  : "text-white/40 border border-white/10 hover:bg-white/5"
              }`}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4">
        <EcosystemHealth />
      </div>

      <div className="mt-4">
        <ClickQualityCard days={days} />
      </div>

      <div className="mt-6 flex gap-1 border-b border-white/10">
        <TabBtn active={tab === "visitors"} onClick={() => setTab("visitors")}>
          🧍 Visitors &amp; Funnel
        </TabBtn>
        <TabBtn active={tab === "revenue"} onClick={() => setTab("revenue")}>
          💵 Revenue &amp; Platforms
        </TabBtn>
      </div>

      {tab === "visitors" && (
        <div className="mt-6">
          <VisitorAnalytics days={days} />
        </div>
      )}

      {tab === "revenue" && (
        <>
          <div className="mt-6">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white/60">
                Stripe sales (live, last {days}d)
              </h2>
              <Link
                href="/shop/dashboard/tools/revenue"
                className="text-[0.7rem] text-purple-300 underline"
              >
                Import weekly Numbers/Excel
              </Link>
            </div>
            <RevenueChart days={days} />
          </div>
          <div className="mt-8">
            <h2 className="mb-3 text-sm font-semibold text-white/60">Platform Comparison</h2>
            <PlatformCompare days={days} />
          </div>
          <div className="mt-10">
            <h2 className="mb-3 text-sm font-semibold text-white/60">
              Imported revenue (all businesses)
            </h2>
            <ImportedRevenue />
          </div>
        </>
      )}
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`-mb-px border-b-2 px-3 py-2 text-sm transition ${
        active
          ? "border-purple-400 text-white"
          : "border-transparent text-white/50 hover:text-white/80"
      }`}
    >
      {children}
    </button>
  );
}
