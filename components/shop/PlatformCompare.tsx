"use client";

import { useEffect, useState } from "react";
import { PLATFORMS } from "@/lib/shop/types";

interface PlatformStats {
  platform: string;
  activeListings: number;
  avgListPrice: number;
  salesCount: number;
  revenue: number;
  profit: number;
  avgSalePrice: number;
}

export function PlatformCompare({ days = 30 }: { days?: number }) {
  const [platforms, setPlatforms] = useState<PlatformStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/shop/analytics/platform?days=${days}`)
      .then((r) => r.json())
      .then(setPlatforms)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [days]);

  if (loading) {
    return <p className="py-4 text-center text-white/30 text-sm">Loading...</p>;
  }

  if (!platforms.length) {
    return <p className="py-4 text-center text-white/30 text-sm">No platform data yet</p>;
  }

  const getColor = (p: string) =>
    PLATFORMS.find((pl) => pl.value === p)?.color || "#6B7280";
  const getLabel = (p: string) =>
    PLATFORMS.find((pl) => pl.value === p)?.label || p;

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {platforms.map((p) => (
        <div
          key={p.platform}
          className="rounded-xl border border-white/10 bg-white/[0.03] p-4"
        >
          <div className="flex items-center gap-2">
            <span
              className="inline-block h-3 w-3 rounded-full"
              style={{ backgroundColor: getColor(p.platform) }}
            />
            <h4 className="text-sm font-semibold text-white">
              {getLabel(p.platform)}
            </h4>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2 text-center">
            <div>
              <p className="text-xs text-white/30">Active</p>
              <p className="text-lg font-bold text-blue-400">{p.activeListings}</p>
            </div>
            <div>
              <p className="text-xs text-white/30">Sales</p>
              <p className="text-lg font-bold text-green-400">{p.salesCount}</p>
            </div>
            <div>
              <p className="text-xs text-white/30">Revenue</p>
              <p className="text-sm font-semibold text-white">${p.revenue.toFixed(0)}</p>
            </div>
            <div>
              <p className="text-xs text-white/30">Profit</p>
              <p className={`text-sm font-semibold ${p.profit >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                ${p.profit.toFixed(0)}
              </p>
            </div>
          </div>

          {p.avgSalePrice > 0 && (
            <p className="mt-2 text-center text-xs text-white/20">
              Avg sale: ${p.avgSalePrice.toFixed(2)}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
