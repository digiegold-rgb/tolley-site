"use client";

import { useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";
import type { WaterReading } from "@/lib/water";
import { WATER_RANGES } from "@/lib/water";

interface Props {
  readings: WaterReading[];
}

const LINES = [
  { key: "ph", color: "#3b82f6", label: "pH" },
  { key: "freeChlorine", color: "#10b981", label: "FC" },
  { key: "alkalinity", color: "#a855f7", label: "Alk" },
  { key: "salt", color: "#00e5c7", label: "Salt" },
  { key: "cya", color: "#f59e0b", label: "CYA" },
  { key: "temperature", color: "#ef4444", label: "Temp" },
] as const;

type Range = "7d" | "30d" | "season" | "all";

export function WaterChemistryChart({ readings }: Props) {
  const [activeLine, setActiveLine] = useState("ph");
  const [range, setRange] = useState<Range>("30d");

  const now = Date.now();
  const filtered = readings.filter((r) => {
    if (range === "all") return true;
    const d = new Date(r.readingAt).getTime();
    if (range === "7d") return now - d < 7 * 86400000;
    if (range === "30d") return now - d < 30 * 86400000;
    // season = current year May-Sep
    const rd = new Date(r.readingAt);
    const yr = new Date().getFullYear();
    return rd.getFullYear() === yr && rd.getMonth() >= 4 && rd.getMonth() <= 8;
  }).reverse(); // chronological

  const chartData = filtered.map((r) => ({
    date: new Date(r.readingAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    ph: r.ph,
    freeChlorine: r.freeChlorine,
    alkalinity: r.alkalinity,
    salt: r.salt,
    cya: r.cya,
    temperature: r.temperature,
  }));

  const lineConfig = LINES.find((l) => l.key === activeLine) || LINES[0];
  const rangeConfig = WATER_RANGES[activeLine as keyof typeof WATER_RANGES];

  return (
    <div className="water-card">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wider">Chemistry Trends</h3>
        <div className="flex gap-1">
          {(["7d", "30d", "season", "all"] as Range[]).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`rounded px-2 py-1 text-xs ${range === r ? "bg-[#00e5c7]/15 text-[#00e5c7]" : "text-white/40 hover:text-white/60"}`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Parameter selector */}
      <div className="mb-4 flex flex-wrap gap-2">
        {LINES.map((l) => (
          <button
            key={l.key}
            onClick={() => setActiveLine(l.key)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              activeLine === l.key
                ? "text-white"
                : "text-white/30 hover:text-white/50"
            }`}
            style={activeLine === l.key ? { backgroundColor: l.color + "30", color: l.color } : {}}
          >
            {l.label}
          </button>
        ))}
      </div>

      {chartData.length === 0 ? (
        <div className="flex h-48 items-center justify-center text-sm text-white/30">
          No readings yet. Add your first reading to see trends.
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="date" tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 11 }} />
            <YAxis tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 11 }} domain={["auto", "auto"]} />
            <Tooltip
              contentStyle={{
                background: "#0d1520",
                border: "1px solid rgba(0,229,199,0.2)",
                borderRadius: 8,
                color: "#fff",
                fontSize: 12,
              }}
            />
            {rangeConfig && (
              <>
                <ReferenceLine y={rangeConfig.min} stroke="rgba(245,158,11,0.3)" strokeDasharray="4 4" />
                <ReferenceLine y={rangeConfig.max} stroke="rgba(245,158,11,0.3)" strokeDasharray="4 4" />
                <ReferenceLine y={rangeConfig.ideal} stroke="rgba(16,185,129,0.3)" strokeDasharray="4 4" />
              </>
            )}
            <Line
              type="monotone"
              dataKey={activeLine}
              stroke={lineConfig.color}
              strokeWidth={2}
              dot={{ fill: lineConfig.color, r: 3 }}
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
