"use client";

import { TrendArrow } from "./TrendArrow";
import { PulseCounter } from "./PulseCounter";

function MiniSparkline({
  data,
  color = "#2563eb",
  width = 80,
  height = 24,
}: {
  data: number[];
  color?: string;
  width?: number;
  height?: number;
}) {
  if (!data.length) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - ((v - min) / range) * height;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg
      width={width}
      height={height}
      className="cl-sparkline"
      viewBox={`0 0 ${width} ${height}`}
    >
      <polyline points={points} stroke={color} />
    </svg>
  );
}

export function RateCard({
  label,
  value,
  change,
  sparkData,
  color,
}: {
  label: string;
  value: number | null;
  change: number;
  sparkData: number[];
  color?: string;
}) {
  const displayValue = value ?? 0;
  return (
    <div className="cl-card" style={{ padding: "1.25rem" }}>
      <div
        style={{
          fontSize: "0.75rem",
          fontWeight: 600,
          color: "var(--cl-text-muted)",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
        }}
      >
        {label}
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          marginTop: "6px",
        }}
      >
        <span
          style={{ fontSize: "1.75rem", fontWeight: 800, color: "var(--cl-text)" }}
        >
          <PulseCounter end={displayValue} decimals={2} suffix="%" />
        </span>
        <TrendArrow value={change} />
      </div>
      <div style={{ marginTop: "8px" }}>
        <MiniSparkline data={sparkData} color={color || "var(--cl-primary)"} />
      </div>
    </div>
  );
}
