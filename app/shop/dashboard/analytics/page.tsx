"use client";

import { useState } from "react";
import { RevenueChart } from "@/components/shop/RevenueChart";
import { PlatformCompare } from "@/components/shop/PlatformCompare";

export default function AnalyticsPage() {
  const [days, setDays] = useState(30);

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

      <div className="mt-6">
        <RevenueChart days={days} />
      </div>

      <div className="mt-8">
        <h2 className="mb-3 text-sm font-semibold text-white/60">Platform Comparison</h2>
        <PlatformCompare days={days} />
      </div>
    </div>
  );
}
