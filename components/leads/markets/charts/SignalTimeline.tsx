"use client";

import { useState } from "react";
import { useSignalHistory, type ArchivedSignal } from "../hooks/useMarketData";

const SIGNAL_COLORS: Record<string, string> = {
  buy: "#22c55e",
  sell: "#ef4444",
  hold: "#eab308",
};

export default function SignalTimeline() {
  const { data, loading } = useSignalHistory(30);
  const [selected, setSelected] = useState<ArchivedSignal | null>(null);

  const signals = data?.signals || [];

  if (loading && signals.length === 0) {
    return (
      <div className="rounded-lg bg-white/5 border border-white/5 p-4 h-[120px] flex items-center justify-center">
        <span className="text-xs text-white/30">Loading signal history...</span>
      </div>
    );
  }

  if (signals.length === 0) {
    return (
      <div className="rounded-lg bg-white/5 border border-white/5 p-4 h-[120px] flex items-center justify-center">
        <span className="text-xs text-white/30">No archived signals yet.</span>
      </div>
    );
  }

  // Group by date
  const dates = [...new Set(signals.map((s) => s.createdAt.slice(0, 10)))].sort();
  const minDate = new Date(dates[0]);
  const maxDate = new Date(dates[dates.length - 1]);
  const rangeDays = Math.max(1, (maxDate.getTime() - minDate.getTime()) / 86400000);

  const width = 800;
  const height = 80;
  const padding = 30;

  return (
    <div className="rounded-lg bg-white/5 border border-white/5 p-4">
      <span className="text-xs text-white/50 mb-2 block">Signal Timeline (30d)</span>
      <div className="overflow-x-auto">
        <svg width={width} height={height + 30} viewBox={`0 0 ${width} ${height + 30}`}>
          {/* Timeline line */}
          <line
            x1={padding}
            y1={height / 2}
            x2={width - padding}
            y2={height / 2}
            stroke="rgba(255,255,255,0.1)"
            strokeWidth="1"
          />
          {/* Date labels */}
          {dates.filter((_, i) => i % Math.max(1, Math.floor(dates.length / 8)) === 0).map((d) => {
            const dayOff = (new Date(d).getTime() - minDate.getTime()) / 86400000;
            const x = padding + (dayOff / rangeDays) * (width - padding * 2);
            return (
              <text key={d} x={x} y={height + 18} textAnchor="middle" fill="rgba(255,255,255,0.2)" fontSize="9">
                {new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </text>
            );
          })}
          {/* Signal dots */}
          {signals.map((sig, i) => {
            const dayOff = (new Date(sig.createdAt).getTime() - minDate.getTime()) / 86400000;
            const x = padding + (dayOff / rangeDays) * (width - padding * 2);
            // Stagger vertically by index within same day
            const sameDay = signals.filter((s) => s.createdAt.slice(0, 10) === sig.createdAt.slice(0, 10));
            const idx = sameDay.indexOf(sig);
            const y = height / 2 + (idx - (sameDay.length - 1) / 2) * 12;
            const color = SIGNAL_COLORS[sig.signal] || "#6b7280";
            const isSelected = selected?.id === sig.id;

            return (
              <g key={sig.id}>
                <circle
                  cx={x}
                  cy={y}
                  r={isSelected ? 7 : 5}
                  fill={color}
                  opacity={sig.confidence}
                  stroke={isSelected ? "white" : "none"}
                  strokeWidth={isSelected ? 2 : 0}
                  className="cursor-pointer transition-all"
                  onClick={() => setSelected(isSelected ? null : sig)}
                />
                {sig.wasAccurate !== null && (
                  <text x={x} y={y - 10} textAnchor="middle" fill="white" fontSize="8">
                    {sig.wasAccurate ? "✓" : "✗"}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
      {/* Selected signal detail */}
      {selected && (
        <div className="mt-2 p-2 rounded bg-white/5 border border-white/5 text-xs">
          <div className="flex items-center gap-2 mb-1">
            <span
              className="font-bold uppercase"
              style={{ color: SIGNAL_COLORS[selected.signal] || "#6b7280" }}
            >
              {selected.signal}
            </span>
            <span className="text-white/40">{selected.category}</span>
            <span className="text-white/30">
              {Math.round(selected.confidence * 100)}%
            </span>
            <span className="text-white/20">
              {new Date(selected.createdAt).toLocaleDateString()}
            </span>
          </div>
          <p className="text-white/60">{selected.title}</p>
          <p className="text-white/30 mt-0.5">{selected.reasoning}</p>
        </div>
      )}
    </div>
  );
}
