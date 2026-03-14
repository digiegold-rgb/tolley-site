"use client";

import dynamic from "next/dynamic";
import type { SnapshotHistoryPoint } from "../hooks/useMarketData";

const AreaChart = dynamic(() => import("recharts").then((m) => m.AreaChart), { ssr: false });
const Area = dynamic(() => import("recharts").then((m) => m.Area), { ssr: false });
const XAxis = dynamic(() => import("recharts").then((m) => m.XAxis), { ssr: false });
const YAxis = dynamic(() => import("recharts").then((m) => m.YAxis), { ssr: false });
const Tooltip = dynamic(() => import("recharts").then((m) => m.Tooltip), { ssr: false });
const ResponsiveContainer = dynamic(() => import("recharts").then((m) => m.ResponsiveContainer), { ssr: false });
const CartesianGrid = dynamic(() => import("recharts").then((m) => m.CartesianGrid), { ssr: false });
const ReferenceLine = dynamic(() => import("recharts").then((m) => m.ReferenceLine), { ssr: false });

interface Props {
  snapshots: SnapshotHistoryPoint[];
}

export default function HealthTrendChart({ snapshots }: Props) {
  const data = snapshots.map((s) => ({
    date: new Date(s.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    National: s.nationalHealth,
    "Kansas City": s.localKcHealth,
  }));

  if (data.length === 0) {
    return (
      <div className="text-center py-8 text-white/30 text-xs">
        Not enough data for health trends yet.
      </div>
    );
  }

  return (
    <div className="rounded-lg bg-white/5 border border-white/5 p-4">
      <span className="text-xs text-white/50 mb-3 block">Health Score Trend</span>
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: -10 }}>
          <defs>
            <linearGradient id="gradNational" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#22d3ee" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="gradKC" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#a78bfa" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#a78bfa" stopOpacity={0} />
            </linearGradient>
          </defs>
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
          <ReferenceLine y={50} stroke="rgba(255,255,255,0.15)" strokeDasharray="3 3" />
          <ReferenceLine y={70} stroke="rgba(34,211,238,0.2)" strokeDasharray="3 3" />
          <Area
            type="monotone"
            dataKey="National"
            stroke="#22d3ee"
            strokeWidth={2}
            fill="url(#gradNational)"
            connectNulls
          />
          <Area
            type="monotone"
            dataKey="Kansas City"
            stroke="#a78bfa"
            strokeWidth={2}
            fill="url(#gradKC)"
            connectNulls
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
