"use client";

import { PulseCounter } from "./PulseCounter";

interface StatsData {
  activeListings: number;
  dataPoints: number;
  activeSignals: number;
  poiCount: number;
  metroAreas: number;
}

export function MarketStats({ stats }: { stats: StatsData }) {
  const items = [
    { label: "Active Listings", value: stats.activeListings, suffix: "" },
    { label: "Data Points", value: stats.dataPoints, suffix: "+" },
    { label: "AI Signals", value: stats.activeSignals, suffix: "" },
    { label: "Local POIs", value: stats.poiCount, suffix: "+" },
    { label: "Metro Areas", value: stats.metroAreas, suffix: "" },
  ];

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
        gap: "0.75rem",
      }}
    >
      {items.map((item) => (
        <div
          key={item.label}
          className="cl-card"
          style={{
            padding: "1.25rem",
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontSize: "1.75rem",
              fontWeight: 800,
              background: "linear-gradient(135deg, #C9A84C, #E8D5A3)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            <PulseCounter end={item.value} decimals={0} suffix={item.suffix} />
          </div>
          <div
            style={{
              marginTop: "4px",
              fontSize: "0.7rem",
              fontWeight: 600,
              color: "var(--cl-text-muted)",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
            }}
          >
            {item.label}
          </div>
        </div>
      ))}
    </div>
  );
}
