"use client";

import { useState, useEffect } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

type ScoreEntry = {
  date: string;
  transunion?: number;
  equifax?: number;
  experian?: number;
  kickoff_score?: number;
};

export function ScoreHistoryChart() {
  const [data, setData] = useState<ScoreEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/credit/scores")
      .then((r) => r.json())
      .then((d) => setData(d.history || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="rounded-2xl border border-white/12 bg-white/5 p-8 text-center backdrop-blur-xl">
        <p className="text-white/40">Loading score history...</p>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="rounded-2xl border border-white/12 bg-white/5 p-8 text-center backdrop-blur-xl">
        <p className="text-lg text-white/40">No score history yet</p>
        <p className="mt-2 text-sm text-white/25">
          Add scores manually or wait for the weekly Credit Karma sync.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/12 bg-white/5 p-5 backdrop-blur-xl">
      <p className="mb-4 text-[0.68rem] font-medium tracking-[0.35em] text-white/50 uppercase">
        Score History
      </p>
      <ResponsiveContainer width="100%" height={320}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
          <XAxis
            dataKey="date"
            stroke="rgba(255,255,255,0.3)"
            tick={{ fontSize: 11 }}
          />
          <YAxis
            domain={[450, 850]}
            stroke="rgba(255,255,255,0.3)"
            tick={{ fontSize: 11 }}
          />
          <Tooltip
            contentStyle={{
              background: "rgba(8,7,15,0.9)",
              border: "1px solid rgba(255,255,255,0.15)",
              borderRadius: 12,
              fontSize: 13,
            }}
          />
          {/* HELOC target line */}
          <ReferenceLine
            y={680}
            stroke="rgba(168,85,247,0.5)"
            strokeDasharray="8 4"
            label={{
              value: "HELOC (680)",
              position: "right",
              fill: "rgba(168,85,247,0.6)",
              fontSize: 11,
            }}
          />
          <Line
            type="monotone"
            dataKey="transunion"
            stroke="#60a5fa"
            strokeWidth={2}
            dot={{ r: 4, fill: "#60a5fa" }}
            name="TransUnion"
            connectNulls
          />
          <Line
            type="monotone"
            dataKey="equifax"
            stroke="#34d399"
            strokeWidth={2}
            dot={{ r: 4, fill: "#34d399" }}
            name="Equifax"
            connectNulls
          />
          <Line
            type="monotone"
            dataKey="experian"
            stroke="#f97316"
            strokeWidth={2}
            dot={{ r: 4, fill: "#f97316" }}
            name="Experian"
            connectNulls
          />
          <Line
            type="monotone"
            dataKey="kickoff_score"
            stroke="#a78bfa"
            strokeWidth={2}
            dot={{ r: 4, fill: "#a78bfa" }}
            name="Kickoff"
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div className="mt-3 flex justify-center gap-5">
        {[
          { name: "TransUnion", color: "#60a5fa" },
          { name: "Equifax", color: "#34d399" },
          { name: "Experian", color: "#f97316" },
          { name: "Kickoff", color: "#a78bfa" },
        ].map((l) => (
          <div key={l.name} className="flex items-center gap-1.5">
            <div
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: l.color }}
            />
            <span className="text-xs text-white/50">{l.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
