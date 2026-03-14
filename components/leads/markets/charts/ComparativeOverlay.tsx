"use client";

import dynamic from "next/dynamic";
import type { SnapshotHistoryPoint } from "../hooks/useMarketData";

const BarChart = dynamic(() => import("recharts").then((m) => m.BarChart), { ssr: false });
const Bar = dynamic(() => import("recharts").then((m) => m.Bar), { ssr: false });
const XAxis = dynamic(() => import("recharts").then((m) => m.XAxis), { ssr: false });
const YAxis = dynamic(() => import("recharts").then((m) => m.YAxis), { ssr: false });
const Tooltip = dynamic(() => import("recharts").then((m) => m.Tooltip), { ssr: false });
const ResponsiveContainer = dynamic(() => import("recharts").then((m) => m.ResponsiveContainer), { ssr: false });
const CartesianGrid = dynamic(() => import("recharts").then((m) => m.CartesianGrid), { ssr: false });
const Legend = dynamic(() => import("recharts").then((m) => m.Legend), { ssr: false });

interface Props {
  snapshots: SnapshotHistoryPoint[];
}

export default function ComparativeOverlay({ snapshots }: Props) {
  // Use last 14 days for readability
  const recent = snapshots.slice(-14);

  const data = recent.map((s) => ({
    date: new Date(s.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    National: s.nationalHealth,
    "Kansas City": s.localKcHealth,
  }));

  if (data.length === 0) {
    return (
      <div className="text-center py-8 text-white/30 text-xs">
        Not enough data for comparison.
      </div>
    );
  }

  return (
    <div className="rounded-lg bg-white/5 border border-white/5 p-4">
      <span className="text-xs text-white/50 mb-3 block">KC vs National Health (14d)</span>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: -10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
          <XAxis
            dataKey="date"
            tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }}
            axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
            tickLine={false}
          />
          <YAxis
            domain={[0, 100]}
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
          <Legend wrapperStyle={{ fontSize: 10, color: "rgba(255,255,255,0.4)" }} />
          <Bar dataKey="National" fill="#22d3ee" fillOpacity={0.7} radius={[2, 2, 0, 0]} />
          <Bar dataKey="Kansas City" fill="#a78bfa" fillOpacity={0.7} radius={[2, 2, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
