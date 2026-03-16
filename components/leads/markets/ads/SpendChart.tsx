"use client";

import { useState } from "react";
import dynamic from "next/dynamic";

const AreaChart = dynamic(() => import("recharts").then((m) => m.AreaChart), { ssr: false });
const Area = dynamic(() => import("recharts").then((m) => m.Area), { ssr: false });
const BarChart = dynamic(() => import("recharts").then((m) => m.BarChart), { ssr: false });
const Bar = dynamic(() => import("recharts").then((m) => m.Bar), { ssr: false });
const XAxis = dynamic(() => import("recharts").then((m) => m.XAxis), { ssr: false });
const YAxis = dynamic(() => import("recharts").then((m) => m.YAxis), { ssr: false });
const Tooltip = dynamic(() => import("recharts").then((m) => m.Tooltip), { ssr: false });
const ResponsiveContainer = dynamic(() => import("recharts").then((m) => m.ResponsiveContainer), { ssr: false });
const CartesianGrid = dynamic(() => import("recharts").then((m) => m.CartesianGrid), { ssr: false });

interface DailyMetric {
  date: string;
  impressions: number;
  clicks: number;
  cost: number;
  conversions: number;
  ctr: number;
  avgCpc: number;
}

type View = "spend" | "clicks" | "conversions";

export default function SpendChart({ data }: { data: DailyMetric[] }) {
  const [view, setView] = useState<View>("spend");

  const chartData = data.map((d) => ({
    date: new Date(d.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    Spend: d.cost,
    Clicks: d.clicks,
    Conversions: d.conversions,
    CTR: d.ctr * 100,
    CPC: d.avgCpc,
  }));

  const viewConfig = {
    spend: { key: "Spend", color: "#f43f5e", format: (v: number) => `$${v.toFixed(2)}`, label: "Spend" },
    clicks: { key: "Clicks", color: "#a78bfa", format: (v: number) => v.toLocaleString(), label: "Clicks" },
    conversions: { key: "Conversions", color: "#34d399", format: (v: number) => v.toFixed(1), label: "Conversions" },
  };

  const cfg = viewConfig[view];

  return (
    <div className="rounded-xl bg-white/5 border border-white/5 p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-white/50">Daily Performance</span>
        <div className="flex gap-1">
          {(Object.entries(viewConfig) as [View, typeof cfg][]).map(([key, v]) => (
            <button
              key={key}
              onClick={() => setView(key)}
              className={`px-2 py-0.5 text-[10px] rounded transition-colors ${
                view === key
                  ? "bg-cyan-500/20 text-cyan-300"
                  : "text-white/30 hover:text-white/50"
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      <ResponsiveContainer width="100%" height={240}>
        {view === "spend" ? (
          <AreaChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: -10 }}>
            <defs>
              <linearGradient id="spendGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={cfg.color} stopOpacity={0.3} />
                <stop offset="95%" stopColor={cfg.color} stopOpacity={0} />
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
              tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v: number) => `$${v}`}
            />
            <Tooltip
              contentStyle={{
                background: "#111",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 8,
                fontSize: 11,
              }}
              labelStyle={{ color: "rgba(255,255,255,0.5)" }}
              formatter={(value) => value != null ? [`$${Number(value).toFixed(2)}`, "Spend"] : ["—"]}
            />
            <Area
              type="monotone"
              dataKey={cfg.key}
              stroke={cfg.color}
              strokeWidth={2}
              fill="url(#spendGrad)"
            />
          </AreaChart>
        ) : (
          <BarChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: -10 }}>
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
              tickFormatter={(v: number) => cfg.format(v)}
            />
            <Tooltip
              contentStyle={{
                background: "#111",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 8,
                fontSize: 11,
              }}
              labelStyle={{ color: "rgba(255,255,255,0.5)" }}
              formatter={(value) => value != null ? [cfg.format(Number(value)), cfg.label] : ["—"]}
            />
            <Bar dataKey={cfg.key} fill={cfg.color} radius={[4, 4, 0, 0]} opacity={0.8} />
          </BarChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}
