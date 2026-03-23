"use client";

import { useState } from "react";

type Recommendation = {
  title: string;
  action: string;
  impact: string;
  urgency: string;
  category: string;
};

const urgencyColors: Record<string, string> = {
  high: "border-red-400/30 bg-red-400/10 text-red-400",
  medium: "border-yellow-400/30 bg-yellow-400/10 text-yellow-400",
  low: "border-green-400/30 bg-green-400/10 text-green-400",
};

const categoryIcons: Record<string, string> = {
  utilization: "\u2193",
  payments: "\u2713",
  disputes: "\u26A0",
  applications: "\u2B50",
  monitoring: "\uD83D\uDD0D",
};

export function RecommendationsPanel({
  recommendations,
}: {
  recommendations?: Recommendation[];
}) {
  const [refreshing, setRefreshing] = useState(false);
  const [recs, setRecs] = useState(recommendations);

  const refresh = async () => {
    setRefreshing(true);
    try {
      const res = await fetch("/api/credit/recommendations", {
        method: "POST",
      });
      const data = await res.json();
      setRecs(data.recommendations);
    } catch {}
    setRefreshing(false);
  };

  return (
    <div className="rounded-2xl border border-white/12 bg-white/5 p-5 backdrop-blur-xl">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-[0.68rem] font-medium tracking-[0.35em] text-white/50 uppercase">
          AI Recommendations
        </p>
        <button
          onClick={refresh}
          disabled={refreshing}
          className="rounded-lg border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/50 transition hover:bg-white/10 hover:text-white/70 disabled:opacity-40"
        >
          {refreshing ? "Generating..." : "Refresh"}
        </button>
      </div>

      {recs && recs.length > 0 ? (
        <div className="space-y-3">
          {recs.map((r, i) => (
            <div
              key={i}
              className="rounded-xl border border-white/8 bg-white/3 p-4"
            >
              <div className="flex items-start gap-3">
                <span className="text-lg">
                  {categoryIcons[r.category] || "\u25CF"}
                </span>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium text-white/85">{r.title}</h4>
                    <span
                      className={`rounded px-1.5 py-0.5 text-[0.6rem] font-medium uppercase ${urgencyColors[r.urgency] || "text-white/40"}`}
                    >
                      {r.urgency}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-white/60">{r.action}</p>
                  <p className="mt-1 text-xs text-purple-400/70">
                    Impact: {r.impact}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-white/30">
          No recommendations yet. Click Refresh to generate AI suggestions based
          on your credit data.
        </p>
      )}
    </div>
  );
}
