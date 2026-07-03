"use client";

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

interface RoundData {
  round: number;
  buys: number;
  sells: number;
  holds: number;
  bullish_pct: number;
  bearish_pct: number;
  neutral_pct: number;
  consensus?: string;
}

interface Props {
  roundHistory: RoundData[];
}

export default function ConsensusDrift({ roundHistory }: Props) {
  const chartData = roundHistory.map((r) => ({
    round: r.round,
    bullish: Math.round(r.bullish_pct * 100),
    bearish: Math.round(r.bearish_pct * 100),
    neutral: Math.round(r.neutral_pct * 100),
  }));

  // Find consensus crossover points (bull/bear flip)
  const crossovers: number[] = [];
  for (let i = 1; i < chartData.length; i++) {
    const prev = chartData[i - 1];
    const curr = chartData[i];
    if (
      (prev.bullish > prev.bearish && curr.bearish >= curr.bullish) ||
      (prev.bearish > prev.bullish && curr.bullish >= curr.bearish)
    ) {
      crossovers.push(curr.round);
    }
  }

  if (chartData.length === 0) {
    return (
      <div className="crypto-card">
        <div className="text-[10px] text-white/30 uppercase tracking-wider mb-2">
          Consensus Drift
        </div>
        <div className="h-40 flex items-center justify-center text-[10px] text-white/15">
          Waiting for round data...
        </div>
      </div>
    );
  }

  const latestRound = chartData[chartData.length - 1];
  const trend =
    latestRound.bullish > latestRound.bearish
      ? "bullish"
      : latestRound.bearish > latestRound.bullish
      ? "bearish"
      : "mixed";

  return (
    <div className="crypto-card">
      <div className="flex items-center justify-between mb-2">
        <div className="text-[10px] text-white/30 uppercase tracking-wider">
          Consensus Drift
        </div>
        <div className="flex items-center gap-2 text-[10px]">
          <span className={
            trend === "bullish" ? "text-green-400" :
            trend === "bearish" ? "text-red-400" : "text-white/40"
          }>
            {trend} {latestRound.bullish}%/{latestRound.bearish}%
          </span>
          <span className="text-white/20">R{latestRound.round}</span>
        </div>
      </div>

      <div className="h-44">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: -10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
            <XAxis
              dataKey="round"
              tick={{ fontSize: 9, fill: "rgba(255,255,255,0.2)" }}
              tickLine={false}
              axisLine={{ stroke: "rgba(255,255,255,0.05)" }}
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fontSize: 9, fill: "rgba(255,255,255,0.2)" }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `${v}%`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "rgba(0,0,0,0.9)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: "8px",
                fontSize: 10,
              }}
              labelStyle={{ color: "rgba(255,255,255,0.5)" }}
              formatter={(value: any, name: any) => [`${value}%`, name]}
            />

            {/* Crossover markers */}
            {crossovers.map((round) => (
              <ReferenceLine
                key={round}
                x={round}
                stroke="rgba(168, 85, 247, 0.4)"
                strokeDasharray="3 3"
                label={{
                  value: "X",
                  position: "top",
                  fill: "rgba(168, 85, 247, 0.6)",
                  fontSize: 8,
                }}
              />
            ))}

            <Line
              type="monotone"
              dataKey="bullish"
              stroke="#22c55e"
              strokeWidth={2}
              dot={false}
              name="Bullish"
            />
            <Line
              type="monotone"
              dataKey="bearish"
              stroke="#ef4444"
              strokeWidth={2}
              dot={false}
              name="Bearish"
            />
            <Line
              type="monotone"
              dataKey="neutral"
              stroke="rgba(148,163,184,0.4)"
              strokeWidth={1}
              dot={false}
              strokeDasharray="4 4"
              name="Neutral"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
