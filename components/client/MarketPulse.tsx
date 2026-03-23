"use client";

import { RateCard } from "./RateCard";
import { SignalBadge } from "./SignalBadge";
import { PulseCounter } from "./PulseCounter";

interface Snapshot {
  mortgage30yr: number | null;
  mortgage15yr: number | null;
  localKcHealth: number | null;
  nationalHealth: number | null;
}

interface Signal {
  id: string;
  signal: string;
  confidence: number;
  title: string;
}

export function MarketPulse({
  snapshot,
  snapshots,
  topSignal,
}: {
  snapshot: Snapshot | null;
  snapshots: Snapshot[];
  topSignal: Signal | null;
}) {
  const rate30Data = snapshots
    .map((s) => s.mortgage30yr)
    .filter((v): v is number => v !== null)
    .reverse();
  const rate15Data = snapshots
    .map((s) => s.mortgage15yr)
    .filter((v): v is number => v !== null)
    .reverse();

  const rate30Change =
    rate30Data.length >= 2
      ? rate30Data[rate30Data.length - 1] - rate30Data[rate30Data.length - 2]
      : 0;
  const rate15Change =
    rate15Data.length >= 2
      ? rate15Data[rate15Data.length - 1] - rate15Data[rate15Data.length - 2]
      : 0;

  const healthScore = snapshot?.localKcHealth ?? snapshot?.nationalHealth ?? 50;

  return (
    <div>
      <h2
        style={{
          fontSize: "1.5rem",
          fontWeight: 800,
          color: "var(--cl-text)",
          marginBottom: "1.25rem",
        }}
      >
        Market Pulse
      </h2>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "1rem",
        }}
      >
        <RateCard
          label="30-Year Fixed"
          value={snapshot?.mortgage30yr ?? null}
          change={rate30Change}
          sparkData={rate30Data}
          color="#C9A84C"
        />
        <RateCard
          label="15-Year Fixed"
          value={snapshot?.mortgage15yr ?? null}
          change={rate15Change}
          sparkData={rate15Data}
          color="#E2C97E"
        />
        {topSignal ? (
          <SignalBadge
            signal={topSignal.signal}
            confidence={topSignal.confidence}
            title={topSignal.title}
            large
          />
        ) : (
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
              Primary Signal
            </div>
            <div
              style={{
                marginTop: "8px",
                fontSize: "0.9rem",
                color: "var(--cl-text-light)",
              }}
            >
              Analyzing…
            </div>
          </div>
        )}
        {/* KC Health Score */}
        <div className="cl-card" style={{ padding: "1.25rem", textAlign: "center" }}>
          <div
            style={{
              fontSize: "0.75rem",
              fontWeight: 600,
              color: "var(--cl-text-muted)",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
            }}
          >
            KC Health Score
          </div>
          <div style={{ marginTop: "10px", position: "relative" }}>
            <svg width="100" height="60" viewBox="0 0 100 60">
              <path
                d="M10 55 A40 40 0 0 1 90 55"
                fill="none"
                stroke="#1E1E24"
                strokeWidth="8"
                strokeLinecap="round"
              />
              <path
                d="M10 55 A40 40 0 0 1 90 55"
                fill="none"
                stroke={
                  healthScore >= 60
                    ? "var(--cl-positive)"
                    : healthScore >= 40
                      ? "var(--cl-accent)"
                      : "var(--cl-negative)"
                }
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={`${(healthScore / 100) * 126} 126`}
                className="cl-gauge-ring"
              />
            </svg>
            <div
              style={{
                fontSize: "1.5rem",
                fontWeight: 800,
                color: "var(--cl-text)",
                marginTop: "-4px",
              }}
            >
              <PulseCounter end={healthScore} decimals={0} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
