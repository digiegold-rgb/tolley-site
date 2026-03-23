"use client";

import { useState } from "react";
import { IndicatorChart } from "./IndicatorChart";
import { StockGrid } from "./StockGrid";

interface Snapshot {
  date: string;
  mortgage30yr: number | null;
  mortgage15yr: number | null;
  localKcHealth: number | null;
  nationalHealth: number | null;
  unemployment: number | null;
  cpi: number | null;
  consumerSentiment: number | null;
  tickers: Record<string, { price: number; change: number; changePercent: number }> | null;
}

export function DataExplorer({
  snapshots,
}: {
  snapshots: Snapshot[];
}) {
  const [open, setOpen] = useState(false);
  const [period, setPeriod] = useState<"7d" | "30d" | "90d">("30d");

  const periodDays = period === "7d" ? 7 : period === "30d" ? 30 : 90;
  const filteredSnapshots = snapshots.slice(0, periodDays);

  // Latest tickers
  const latestTickers = snapshots[0]?.tickers || null;

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          cursor: "pointer",
          marginBottom: open ? "1.25rem" : 0,
        }}
        onClick={() => setOpen(!open)}
      >
        <h2
          style={{
            fontSize: "1.5rem",
            fontWeight: 800,
            color: "var(--cl-text)",
          }}
        >
          Deep Data Explorer
        </h2>
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--cl-text-muted)"
          strokeWidth="2"
          style={{
            transition: "transform 0.3s ease",
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
          }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </div>

      {!open && (
        <p
          style={{
            marginTop: "0.5rem",
            fontSize: "0.85rem",
            color: "var(--cl-text-light)",
          }}
        >
          Economic indicators, housing stocks, and historical trends. Click to
          expand.
        </p>
      )}

      {open && (
        <div>
          {/* Period selector */}
          <div
            style={{
              display: "flex",
              gap: "4px",
              marginBottom: "1.5rem",
            }}
          >
            {(["7d", "30d", "90d"] as const).map((p) => (
              <button
                key={p}
                onClick={(e) => {
                  e.stopPropagation();
                  setPeriod(p);
                }}
                style={{
                  padding: "6px 16px",
                  borderRadius: "8px",
                  border: "1px solid var(--cl-border)",
                  background:
                    period === p ? "var(--cl-primary)" : "var(--cl-card)",
                  color: period === p ? "white" : "var(--cl-text-muted)",
                  fontWeight: 600,
                  fontSize: "0.8rem",
                  cursor: "pointer",
                }}
              >
                {p}
              </button>
            ))}
          </div>

          {/* Charts */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
              gap: "1.25rem",
              marginBottom: "1.5rem",
            }}
          >
            <IndicatorChart
              title="KC Health Score"
              data={filteredSnapshots.map((s) => ({
                date: s.date,
                value: s.localKcHealth,
              }))}
              color="#2563eb"
            />
            <IndicatorChart
              title="30yr Mortgage Rate"
              data={filteredSnapshots.map((s) => ({
                date: s.date,
                value: s.mortgage30yr,
              }))}
              color="#0ea5e9"
              suffix="%"
            />
            <IndicatorChart
              title="Consumer Sentiment"
              data={filteredSnapshots.map((s) => ({
                date: s.date,
                value: s.consumerSentiment,
              }))}
              color="#f97316"
            />
            <IndicatorChart
              title="Unemployment Rate"
              data={filteredSnapshots.map((s) => ({
                date: s.date,
                value: s.unemployment,
              }))}
              color="#f43f5e"
              suffix="%"
            />
          </div>

          {/* Housing Stocks */}
          {latestTickers && <StockGrid tickers={latestTickers} />}
        </div>
      )}
    </div>
  );
}
