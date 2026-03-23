"use client";

import { type WaterParam, type WaterStatus, WATER_RANGES, getStatus, getStatusColor, PARAM_ICONS } from "@/lib/water";

interface Props {
  param: WaterParam;
  value: number | null | undefined;
}

export function WaterStatusCard({ param, value }: Props) {
  const range = WATER_RANGES[param];
  const status: WaterStatus = getStatus(param, value ?? null);
  const color = getStatusColor(status);
  const icon = PARAM_ICONS[param] || "💧";

  const statusClass =
    status === "good" ? "water-status-good" :
    status === "warning" ? "water-status-warning" :
    "water-status-critical";

  return (
    <div className={`water-card ${statusClass} flex flex-col gap-2`}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-white/50">{range.label}</span>
        <span className="text-lg">{icon}</span>
      </div>
      <div className="flex items-baseline gap-2">
        <span
          className="text-3xl font-bold"
          style={{ color: value != null ? color : "rgba(255,255,255,0.3)" }}
        >
          {value != null ? value : "—"}
        </span>
        {range.unit && (
          <span className="text-sm text-white/40">{range.unit}</span>
        )}
      </div>
      <div className="text-xs text-white/30">
        Ideal: {range.min}–{range.max} {range.unit}
      </div>
    </div>
  );
}
