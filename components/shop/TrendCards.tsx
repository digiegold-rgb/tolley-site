"use client";

import { useState, useEffect } from "react";

interface TrendSignal {
  id: string;
  category: string;
  platform: string | null;
  signalType: string;
  title: string;
  body: string | null;
  metric: number | null;
  metricLabel: string | null;
  confidence: number | null;
  status: string;
  createdAt: string;
}

interface TrendsResponse {
  trends: TrendSignal[];
  stats: {
    active: number;
    total: number;
    byType: { type: string; count: number }[];
  };
}

const SIGNAL_STYLES: Record<string, { icon: string; color: string; label: string }> = {
  hot_category: { icon: "🔥", color: "#EF4444", label: "Hot Category" },
  price_spike: { icon: "📈", color: "#22C55E", label: "Price Spike" },
  sell_through_high: { icon: "⚡", color: "#FACC15", label: "High Sell-Through" },
  seasonal_peak: { icon: "📅", color: "#3B82F6", label: "Seasonal Peak" },
  viral: { icon: "🌊", color: "#8B5CF6", label: "Viral" },
};

const PLATFORM_LABELS: Record<string, string> = {
  ebay: "eBay Niche Scan",
  google_trends: "Google Rising Search",
  ai_synthesis: "AI Cross-Reference",
  reddit: "Reddit Intel",
  unconventional: "Hidden Source",
  alibaba: "Alibaba Forecast",
  liquidation: "Liquidation Alert",
};

export function TrendCards() {
  const [data, setData] = useState<TrendsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    loadTrends();
  }, []);

  async function loadTrends() {
    setLoading(true);
    try {
      const res = await fetch("/api/shop/trends?status=active&limit=50");
      if (res.ok) {
        setData(await res.json());
      }
    } catch {
      // silent
    }
    setLoading(false);
  }

  async function dismissTrend(id: string) {
    await fetch("/api/shop/trends", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status: "dismissed" }),
    });
    setData((prev) =>
      prev
        ? { ...prev, trends: prev.trends.filter((t) => t.id !== id) }
        : prev
    );
  }

  async function createDraftFromTrend(trend: TrendSignal) {
    try {
      const res = await fetch("/api/shop/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: trend.category,
          description: `Sourced from trend: ${trend.title}. ${trend.body || ""}`,
          category: "Other",
          sourcingType: "online_arbitrage",
          status: "draft",
        }),
      });
      if (res.ok) {
        alert(`Draft created for "${trend.category}"!`);
      }
    } catch {
      alert("Failed to create draft");
    }
  }

  if (loading) {
    return <p className="py-4 text-center text-white/30 text-sm">Scanning intelligence feeds...</p>;
  }

  const trends = data?.trends || [];
  const stats = data?.stats;

  if (trends.length === 0) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6 text-center">
        <p className="text-3xl">🛰️</p>
        <p className="mt-2 text-sm text-white/40">
          No active signals yet. The turbo scanner hits 60+ sources twice daily
          (3 AM & 3 PM) — Google Trends, Reddit, Goodwill, GovDeals, liquidation
          sites, niche eBay categories, and AI synthesis.
        </p>
        <p className="mt-2 text-xs text-white/20">
          First run will populate signals automatically.
        </p>
      </div>
    );
  }

  const signalTypes = [...new Set(trends.map((t) => t.signalType))];
  const filtered = filter === "all" ? trends : trends.filter((t) => t.signalType === filter);

  return (
    <div>
      {/* Stats bar */}
      {stats && (
        <div className="mb-4 flex items-center gap-4 rounded-xl border border-white/10 bg-white/[0.02] px-4 py-2.5">
          <span className="text-sm font-bold text-white">{stats.active}</span>
          <span className="text-xs text-white/30">active signals</span>
          <span className="text-white/10">|</span>
          {stats.byType.map((bt) => {
            const style = SIGNAL_STYLES[bt.type];
            return (
              <span key={bt.type} className="flex items-center gap-1 text-xs">
                <span>{style?.icon || "?"}</span>
                <span style={{ color: style?.color || "#fff" }}>{bt.count}</span>
              </span>
            );
          })}
        </div>
      )}

      {/* Filters */}
      <div className="mb-4 flex flex-wrap gap-2">
        <button
          onClick={() => setFilter("all")}
          className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
            filter === "all"
              ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
              : "text-white/40 border border-white/10 hover:bg-white/5"
          }`}
        >
          All ({trends.length})
        </button>
        {signalTypes.map((type) => {
          const style = SIGNAL_STYLES[type];
          const count = trends.filter((t) => t.signalType === type).length;
          return (
            <button
              key={type}
              onClick={() => setFilter(type)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                filter === type
                  ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                  : "text-white/40 border border-white/10 hover:bg-white/5"
              }`}
            >
              {style?.icon} {style?.label || type} ({count})
            </button>
          );
        })}
      </div>

      {/* Trend cards */}
      <div className="grid gap-3 sm:grid-cols-2">
        {filtered.map((trend) => {
          const style = SIGNAL_STYLES[trend.signalType] || SIGNAL_STYLES.hot_category;
          const platformLabel = PLATFORM_LABELS[trend.platform || ""] || trend.platform || "";

          return (
            <div
              key={trend.id}
              className="rounded-xl border border-white/10 bg-white/[0.03] p-4 transition hover:border-white/15"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-2 min-w-0 flex-1">
                  <span className="text-xl mt-0.5">{style.icon}</span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white leading-tight">
                      {trend.title}
                    </p>
                    <div className="mt-0.5 flex items-center gap-2">
                      <span className="text-[0.6rem] text-white/20 capitalize">
                        {style.label}
                      </span>
                      {platformLabel && (
                        <>
                          <span className="text-white/10">|</span>
                          <span className="text-[0.6rem] text-purple-400/60">
                            {platformLabel}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => dismissTrend(trend.id)}
                  className="text-xs text-white/15 hover:text-white/40 ml-2"
                >
                  ✕
                </button>
              </div>

              {trend.body && (
                <p className="mt-2 text-xs text-white/40 leading-relaxed">
                  {trend.body}
                </p>
              )}

              <div className="mt-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {trend.confidence !== null && (
                    <div className="flex items-center gap-1.5">
                      <div className="h-1.5 w-20 rounded-full bg-white/10 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${trend.confidence * 100}%`,
                            backgroundColor: style.color,
                          }}
                        />
                      </div>
                      <span className="text-[0.6rem] text-white/25">
                        {Math.round(trend.confidence * 100)}%
                      </span>
                    </div>
                  )}
                  {trend.metric !== null && trend.metricLabel && (
                    <span className="text-[0.6rem] text-white/20">
                      <span className="font-medium" style={{ color: style.color }}>
                        {trend.metric.toFixed(1)}
                      </span>{" "}
                      {trend.metricLabel}
                    </span>
                  )}
                </div>

                <button
                  onClick={() => createDraftFromTrend(trend)}
                  className="rounded-lg bg-purple-500/15 border border-purple-500/30 px-2.5 py-1 text-[0.65rem] text-purple-400 hover:bg-purple-500/25 transition"
                >
                  Source This
                </button>
              </div>

              <p className="mt-2 text-[0.55rem] text-white/10">
                {new Date(trend.createdAt).toLocaleString()}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
