"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import type { SnapshotHistoryPoint } from "../hooks/useMarketData";

const LineChart = dynamic(() => import("recharts").then((m) => m.LineChart), { ssr: false });
const Line = dynamic(() => import("recharts").then((m) => m.Line), { ssr: false });
const XAxis = dynamic(() => import("recharts").then((m) => m.XAxis), { ssr: false });
const YAxis = dynamic(() => import("recharts").then((m) => m.YAxis), { ssr: false });
const Tooltip = dynamic(() => import("recharts").then((m) => m.Tooltip), { ssr: false });
const ResponsiveContainer = dynamic(() => import("recharts").then((m) => m.ResponsiveContainer), { ssr: false });
const CartesianGrid = dynamic(() => import("recharts").then((m) => m.CartesianGrid), { ssr: false });
const Legend = dynamic(() => import("recharts").then((m) => m.Legend), { ssr: false });

type Period = "7d" | "30d" | "90d";

interface Props {
  snapshots: SnapshotHistoryPoint[];
  onPeriodChange?: (days: number) => void;
}

const PERIOD_DAYS: Record<Period, number> = { "7d": 7, "30d": 30, "90d": 90 };

export default function RateTrendChart({ snapshots, onPeriodChange }: Props) {
  const [period, setPeriod] = useState<Period>("30d");

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - PERIOD_DAYS[period]);

  const data = snapshots
    .filter((s) => new Date(s.date) >= cutoff)
    .map((s) => ({
      date: new Date(s.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      "30yr Mortgage": s.mortgage30yr,
      "15yr Mortgage": s.mortgage15yr,
      "10yr Treasury": s.treasury10yr,
      "30yr Treasury": s.treasury30yr,
    }));

  if (data.length === 0) {
    return (
      <div className="text-center py-8 text-white/30 text-xs">
        Not enough historical data for rate trends yet.
      </div>
    );
  }

  return (
    <div className="rounded-lg bg-white/5 border border-white/5 p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-white/50">Rate Trends</span>
        <div className="flex gap-1">
          {(["7d", "30d", "90d"] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => {
                setPeriod(p);
                onPeriodChange?.(PERIOD_DAYS[p]);
              }}
              className={`px-2 py-0.5 text-[10px] rounded ${
                period === p
                  ? "bg-cyan-500/20 text-cyan-300"
                  : "text-white/30 hover:text-white/50"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: -10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
          <XAxis
            dataKey="date"
            tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }}
            axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
            tickLine={false}
          />
          <YAxis
            domain={["auto", "auto"]}
            tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v: number) => `${v.toFixed(1)}%`}
          />
          <Tooltip
            contentStyle={{
              background: "#111",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 8,
              fontSize: 11,
            }}
            labelStyle={{ color: "rgba(255,255,255,0.5)" }}
            formatter={(value) => value != null ? [`${Number(value).toFixed(3)}%`] : ["—"]}
          />
          <Legend
            wrapperStyle={{ fontSize: 10, color: "rgba(255,255,255,0.4)" }}
          />
          <Line type="monotone" dataKey="30yr Mortgage" stroke="#f59e0b" strokeWidth={2} dot={false} connectNulls />
          <Line type="monotone" dataKey="15yr Mortgage" stroke="#22d3ee" strokeWidth={2} dot={false} connectNulls />
          <Line type="monotone" dataKey="10yr Treasury" stroke="#a78bfa" strokeWidth={1.5} dot={false} strokeDasharray="4 2" connectNulls />
          <Line type="monotone" dataKey="30yr Treasury" stroke="#f472b6" strokeWidth={1.5} dot={false} strokeDasharray="4 2" connectNulls />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
