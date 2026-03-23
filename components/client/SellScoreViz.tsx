"use client";

import { useEffect, useState } from "react";

export function SellScoreViz({ score }: { score: number }) {
  const [animatedScore, setAnimatedScore] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => setAnimatedScore(score), 100);
    return () => clearTimeout(timer);
  }, [score]);

  const circumference = 2 * Math.PI * 45;
  const offset = circumference - (animatedScore / 100) * circumference;

  const color =
    score >= 70
      ? "var(--cl-positive)"
      : score >= 40
        ? "var(--cl-accent)"
        : "var(--cl-negative)";

  const label =
    score >= 70 ? "Great Time to Sell" : score >= 40 ? "Fair Market" : "Consider Waiting";

  return (
    <div style={{ textAlign: "center" }}>
      <svg width="140" height="140" viewBox="0 0 100 100">
        <circle
          cx="50"
          cy="50"
          r="45"
          fill="none"
          stroke="#e2e8f0"
          strokeWidth="8"
        />
        <circle
          cx="50"
          cy="50"
          r="45"
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform="rotate(-90 50 50)"
          className="cl-gauge-ring"
        />
        <text
          x="50"
          y="46"
          textAnchor="middle"
          style={{
            fontSize: "24px",
            fontWeight: 800,
            fill: "var(--cl-text)",
          }}
        >
          {animatedScore}
        </text>
        <text
          x="50"
          y="62"
          textAnchor="middle"
          style={{
            fontSize: "8px",
            fontWeight: 600,
            fill: "var(--cl-text-muted)",
            textTransform: "uppercase",
          }}
        >
          Sell Score
        </text>
      </svg>
      <div
        style={{
          marginTop: "0.5rem",
          fontSize: "0.9rem",
          fontWeight: 700,
          color,
        }}
      >
        {label}
      </div>
    </div>
  );
}
