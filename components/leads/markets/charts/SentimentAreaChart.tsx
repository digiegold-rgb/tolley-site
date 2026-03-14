"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { useSentimentHistory } from "../hooks/useMarketData";

const AreaChart = dynamic(() => import("recharts").then((m) => m.AreaChart), { ssr: false });
const Area = dynamic(() => import("recharts").then((m) => m.Area), { ssr: false });
const XAxis = dynamic(() => import("recharts").then((m) => m.XAxis), { ssr: false });
const YAxis = dynamic(() => import("recharts").then((m) => m.YAxis), { ssr: false });
const Tooltip = dynamic(() => import("recharts").then((m) => m.Tooltip), { ssr: false });
const ResponsiveContainer = dynamic(() => import("recharts").then((m) => m.ResponsiveContainer), { ssr: false });
const CartesianGrid = dynamic(() => import("recharts").then((m) => m.CartesianGrid), { ssr: false });

type Scope = "national" | "local_kc" | "all";

export default function SentimentAreaChart() {
  const [scope, setScope] = useState<Scope>("all");
  const { data, loading } = useSentimentHistory(scope, 30);

  const chartData = (data?.sentiment || []).map((d) => ({
    date: new Date(d.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    Bullish: d.bullish,
    Neutral: d.neutral,
    Bearish: d.bearish,
  }));

  if (loading && chartData.length === 0) {
    return (
      <div className="rounded-lg bg-white/5 border border-white/5 p-4 h-[260px] flex items-center justify-center">
        <span className="text-xs text-white/30">Loading sentiment...</span>
      </div>
    );
  }

  if (chartData.length === 0) {
    return (
      <div className="rounded-lg bg-white/5 border border-white/5 p-4 h-[260px] flex items-center justify-center">
        <span className="text-xs text-white/30">No sentiment data yet.</span>
      </div>
    );
  }

  return (
    <div className="rounded-lg bg-white/5 border border-white/5 p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-white/50">Sentiment Distribution (30d)</span>
        <div className="flex gap-1">
          {(["all", "national", "local_kc"] as Scope[]).map((s) => (
            <button
              key={s}
              onClick={() => setScope(s)}
              className={`px-2 py-0.5 text-[10px] rounded ${
                scope === s
                  ? "bg-cyan-500/20 text-cyan-300"
                  : "text-white/30 hover:text-white/50"
              }`}
            >
              {s === "all" ? "Both" : s === "national" ? "National" : "KC"}
            </button>
          ))}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: -10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
          <XAxis
            dataKey="date"
            tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }}
            axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              background: "#111",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 8,
              fontSize: 11,
            }}
            labelStyle={{ color: "rgba(255,255,255,0.5)" }}
          />
          <Area type="monotone" dataKey="Bullish" stackId="1" stroke="#22c55e" fill="#22c55e" fillOpacity={0.6} />
          <Area type="monotone" dataKey="Neutral" stackId="1" stroke="#6b7280" fill="#6b7280" fillOpacity={0.4} />
          <Area type="monotone" dataKey="Bearish" stackId="1" stroke="#ef4444" fill="#ef4444" fillOpacity={0.6} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
