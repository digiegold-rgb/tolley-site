/**
 * ChartScene — animated chart for data-heavy script beats.
 *
 * Uses recharts (already a dependency). Critically, recharts' built-in
 * animation is wallclock-based and FIGHTS Remotion's per-frame render —
 * we set isAnimationActive={false} and lerp the data prop manually using
 * useCurrentFrame() / fps. This is the standard Remotion + recharts
 * pattern (see https://www.remotion.dev/docs/charts).
 *
 * Three animation modes:
 *   - buildUp: bars/lines lerp from 0 → final value (default)
 *   - fadeIn: chart appears fully built then fades in
 *   - drawLine: line charts only — line draws left-to-right
 *
 * Fallback: if the chart fails to render or data is malformed, the scene
 * router will substitute the still image.
 */
"use client";

import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ChartData } from "@/lib/vater/video-spec";

const DEFAULT_PALETTE = [
  "#38bdf8", "#facc15", "#f472b6", "#a78bfa",
  "#34d399", "#fb923c", "#60a5fa", "#fda4af",
];

export function ChartScene({
  data,
  durationFrames,
}: {
  data: ChartData;
  durationFrames: number;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Build-up window: first 1 second (or 30% of duration, whichever is smaller)
  const buildFrames = Math.min(fps, Math.floor(durationFrames * 0.3));
  const progress = interpolate(frame, [0, buildFrames], [0, 1], {
    extrapolateRight: "clamp",
    extrapolateLeft: "clamp",
  });

  const opacity = interpolate(
    frame,
    [0, fps * 0.3, durationFrames - fps * 0.3, durationFrames],
    [0, 1, 1, 0],
    { extrapolateRight: "clamp" },
  );

  // Lerp values toward final based on animation mode
  const lerpFactor = data.animation === "fadeIn" ? 1 : progress;

  // Build the recharts dataset: { label, series1: lerpedValue, series2: ..., ... }
  const chartRows = data.labels.map((label, i) => {
    const row: Record<string, string | number> = { label };
    for (const series of data.series) {
      const target = series.values[i] ?? 0;
      row[series.name] = target * lerpFactor;
    }
    return row;
  });

  const pieRows =
    data.type === "pie" && data.series.length > 0
      ? data.labels.map((label, i) => ({
          name: label,
          value: (data.series[0].values[i] ?? 0) * lerpFactor,
        }))
      : [];

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#0f172a",
        display: "flex",
        flexDirection: "column",
        padding: 56,
        opacity,
      }}
    >
      {data.title ? (
        <h2
          style={{
            margin: "0 0 32px",
            color: "#f8fafc",
            fontSize: 56,
            fontWeight: 700,
            fontFamily:
              "-apple-system, 'Segoe UI', system-ui, 'Inter', sans-serif",
            textAlign: "center",
          }}
        >
          {data.title}
        </h2>
      ) : null}
      <div style={{ flex: 1, minHeight: 0 }}>
        <ResponsiveContainer width="100%" height="100%">
          {data.type === "bar" ? (
            <BarChart data={chartRows} margin={{ top: 20, right: 40, bottom: 20, left: 40 }}>
              <CartesianGrid strokeDasharray="3 6" stroke="#334155" />
              <XAxis dataKey="label" stroke="#cbd5e1" tick={{ fontSize: 22 }} />
              <YAxis stroke="#cbd5e1" tick={{ fontSize: 22 }} label={data.yAxisLabel ? { value: data.yAxisLabel, angle: -90, position: "insideLeft", fill: "#cbd5e1" } : undefined} />
              <Tooltip wrapperStyle={{ display: "none" }} />
              {data.series.length > 1 ? <Legend wrapperStyle={{ color: "#cbd5e1" }} /> : null}
              {data.series.map((s, idx) => (
                <Bar
                  key={s.name}
                  dataKey={s.name}
                  fill={s.color || DEFAULT_PALETTE[idx % DEFAULT_PALETTE.length]}
                  isAnimationActive={false}
                  radius={[6, 6, 0, 0]}
                />
              ))}
            </BarChart>
          ) : data.type === "line" ? (
            <LineChart data={chartRows} margin={{ top: 20, right: 40, bottom: 20, left: 40 }}>
              <CartesianGrid strokeDasharray="3 6" stroke="#334155" />
              <XAxis dataKey="label" stroke="#cbd5e1" tick={{ fontSize: 22 }} />
              <YAxis stroke="#cbd5e1" tick={{ fontSize: 22 }} />
              {data.series.length > 1 ? <Legend wrapperStyle={{ color: "#cbd5e1" }} /> : null}
              {data.series.map((s, idx) => (
                <Line
                  key={s.name}
                  dataKey={s.name}
                  stroke={s.color || DEFAULT_PALETTE[idx % DEFAULT_PALETTE.length]}
                  strokeWidth={4}
                  dot={{ r: 6 }}
                  isAnimationActive={false}
                />
              ))}
            </LineChart>
          ) : (
            <PieChart>
              <Pie
                data={pieRows}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius="70%"
                isAnimationActive={false}
                label={{ fill: "#f8fafc", fontSize: 22 }}
              >
                {pieRows.map((_, idx) => (
                  <Cell key={idx} fill={DEFAULT_PALETTE[idx % DEFAULT_PALETTE.length]} />
                ))}
              </Pie>
              <Legend wrapperStyle={{ color: "#cbd5e1", fontSize: 22 }} />
            </PieChart>
          )}
        </ResponsiveContainer>
      </div>
    </AbsoluteFill>
  );
}
