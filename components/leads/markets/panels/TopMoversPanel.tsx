"use client";

import { useTopMovers } from "../hooks/useMarketData";

const TYPE_LABELS: Record<string, string> = {
  economic_indicator: "ECON",
  stock_reading: "STOCK",
  article_summary: "NEWS",
  video_analysis: "VIDEO",
  manual_note: "NOTE",
};

export default function TopMoversPanel() {
  const { data, loading } = useTopMovers(10);
  const movers = data?.movers || [];

  if (loading && movers.length === 0) return null;
  if (movers.length === 0) return null;

  const maxImpact = Math.max(...movers.map((m) => m.impactScore || 0), 0.01);

  return (
    <div className="rounded-lg bg-white/5 border border-white/5 p-4">
      <span className="text-xs text-white/50 mb-3 block">Top Movers Today</span>
      <div className="space-y-1.5">
        {movers.map((m) => {
          const pct = ((m.impactScore || 0) / maxImpact) * 100;
          const isPositive = (m.changePercent ?? 0) >= 0;
          return (
            <div key={m.id} className="flex items-center gap-2">
              <span className="text-[9px] text-white/30 w-10 shrink-0 uppercase">
                {TYPE_LABELS[m.type] || m.type.slice(0, 5)}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1">
                  <span className="text-[11px] text-white/70 truncate">{m.title}</span>
                  {m.changePercent != null && (
                    <span className={`text-[9px] font-medium shrink-0 ${isPositive ? "text-green-400" : "text-red-400"}`}>
                      {isPositive ? "+" : ""}{m.changePercent.toFixed(2)}%
                    </span>
                  )}
                </div>
                <div className="h-1 bg-white/5 rounded-full mt-0.5">
                  <div
                    className={`h-full rounded-full transition-all ${isPositive ? "bg-green-500/50" : "bg-red-500/50"}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
