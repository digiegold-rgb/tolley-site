"use client";

import { type WaterParam, type WaterStatus, WATER_RANGES, getStatus, getStatusColor, PARAM_ICONS } from "@/lib/water";

interface Props {
  param: WaterParam;
  value: number | null | undefined;
}

const STATUS_MESSAGES: Record<WaterStatus, { prefix: string; tone: string }> = {
  good:     { prefix: "✓", tone: "Ideal range" },
  warning:  { prefix: "⚠", tone: "Out of target" },
  critical: { prefix: "⛔", tone: "Action required" },
};

export function WaterStatusCard({ param, value }: Props) {
  const range = WATER_RANGES[param];
  const status: WaterStatus = getStatus(param, value ?? null);
  const color = getStatusColor(status);
  const icon = PARAM_ICONS[param] || "💧";

  const statusClass =
    status === "good" ? "water-status-good" :
    status === "warning" ? "water-status-warning" :
    "water-status-critical";

  const msg = STATUS_MESSAGES[status];

  return (
    <div className={`water-card ${statusClass} flex flex-col gap-1`}>
      <div className="flex items-start justify-between">
        <span
          className="mb-[6px] font-medium uppercase text-white/45"
          style={{
            fontFamily: "var(--font-jetbrains-mono), monospace",
            fontSize: "0.54rem",
            letterSpacing: "0.16em",
          }}
        >
          {range.label}
        </span>
        <span className="text-lg leading-none">{icon}</span>
      </div>
      <div className="mb-1 flex items-baseline gap-2">
        <span
          className="text-[1.6rem] font-bold text-white"
          style={{ color: value != null ? "#ffffff" : "rgba(255,255,255,0.3)" }}
        >
          {value != null ? value : "—"}
        </span>
        {range.unit && (
          <span className="text-sm text-white/40">{range.unit}</span>
        )}
      </div>
      <div
        className="text-[0.78rem]"
        style={{
          color: value != null ? color : "rgba(255,255,255,0.35)",
          fontFamily: "var(--font-sora), sans-serif",
        }}
      >
        {msg.prefix} {msg.tone} {range.min}–{range.max} {range.unit}
      </div>
    </div>
  );
}
