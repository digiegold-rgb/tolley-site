"use client";

import { useEffect, useState } from "react";

interface DailyData {
  date: string;
  revenue: number;
  profit: number;
  count: number;
}

interface PlatformData {
  platform: string;
  revenue: number;
  profit: number;
  count: number;
}

export function RevenueChart({ days = 30 }: { days?: number }) {
  const [daily, setDaily] = useState<DailyData[]>([]);
  const [byPlatform, setByPlatform] = useState<PlatformData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/shop/analytics/revenue?days=${days}`)
      .then((r) => r.json())
      .then((data) => {
        setDaily(data.daily || []);
        setByPlatform(data.byPlatform || []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [days]);

  if (loading) {
    return <p className="py-4 text-center text-white/30 text-sm">Loading chart...</p>;
  }

  const maxRevenue = Math.max(...daily.map((d) => d.revenue), 1);
  const totalRevenue = daily.reduce((s, d) => s + d.revenue, 0);
  const totalProfit = daily.reduce((s, d) => s + d.profit, 0);
  const totalSales = daily.reduce((s, d) => s + d.count, 0);

  return (
    <div>
      {/* Summary */}
      <div className="mb-4 grid grid-cols-3 gap-3">
        <div className="rounded-lg bg-white/[0.03] p-3 text-center">
          <p className="text-xs text-white/30">Revenue</p>
          <p className="text-lg font-bold text-green-400">${totalRevenue.toFixed(2)}</p>
        </div>
        <div className="rounded-lg bg-white/[0.03] p-3 text-center">
          <p className="text-xs text-white/30">Profit</p>
          <p className="text-lg font-bold text-emerald-400">${totalProfit.toFixed(2)}</p>
        </div>
        <div className="rounded-lg bg-white/[0.03] p-3 text-center">
          <p className="text-xs text-white/30">Sales</p>
          <p className="text-lg font-bold text-white">{totalSales}</p>
        </div>
      </div>

      {/* Bar chart — SVG */}
      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
        <h4 className="mb-3 text-xs text-white/40">Daily Revenue ({days}d)</h4>
        <div className="flex items-end gap-[2px] h-32">
          {daily.map((d) => {
            const h = maxRevenue > 0 ? (d.revenue / maxRevenue) * 100 : 0;
            return (
              <div
                key={d.date}
                className="flex-1 rounded-t transition-all hover:opacity-80"
                style={{
                  height: `${Math.max(h, 1)}%`,
                  backgroundColor: d.profit >= 0 ? "rgba(34,197,94,0.5)" : "rgba(239,68,68,0.5)",
                }}
                title={`${d.date}: $${d.revenue} (${d.count} sales)`}
              />
            );
          })}
        </div>
        <div className="mt-1 flex justify-between text-[0.6rem] text-white/20">
          <span>{daily[0]?.date?.slice(5) || ""}</span>
          <span>{daily[daily.length - 1]?.date?.slice(5) || ""}</span>
        </div>
      </div>

      {/* Platform breakdown */}
      {byPlatform.length > 0 && (
        <div className="mt-4">
          <h4 className="mb-2 text-xs text-white/40">By Platform</h4>
          <div className="space-y-1.5">
            {byPlatform.map((p) => {
              const pct = totalRevenue > 0 ? (p.revenue / totalRevenue) * 100 : 0;
              return (
                <div key={p.platform} className="flex items-center gap-3">
                  <span className="w-24 text-xs text-white/50 capitalize">
                    {p.platform.replace("_", " ")}
                  </span>
                  <div className="flex-1 h-4 rounded-full bg-white/5 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-purple-500/50"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="w-20 text-right text-xs text-white/40">
                    ${p.revenue.toFixed(0)} ({p.count})
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
