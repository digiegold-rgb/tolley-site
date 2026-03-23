"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface DataPoint {
  date: string;
  value: number | null;
}

export function IndicatorChart({
  title,
  data,
  color = "#2563eb",
  suffix = "",
}: {
  title: string;
  data: DataPoint[];
  color?: string;
  suffix?: string;
}) {
  const validData = data
    .filter((d) => d.value !== null)
    .reverse()
    .map((d) => ({
      date: new Date(d.date).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }),
      value: d.value,
    }));

  if (!validData.length) {
    return (
      <div className="cl-card-static" style={{ padding: "1.25rem" }}>
        <div
          style={{
            fontSize: "0.85rem",
            fontWeight: 700,
            color: "var(--cl-text)",
            marginBottom: "0.5rem",
          }}
        >
          {title}
        </div>
        <p
          style={{
            fontSize: "0.8rem",
            color: "var(--cl-text-light)",
          }}
        >
          No data available
        </p>
      </div>
    );
  }

  return (
    <div
      className="cl-card-static cl-chart"
      style={{ padding: "1.25rem" }}
    >
      <div
        style={{
          fontSize: "0.85rem",
          fontWeight: 700,
          color: "var(--cl-text)",
          marginBottom: "0.75rem",
        }}
      >
        {title}
      </div>
      <ResponsiveContainer width="100%" height={180}>
        <LineChart data={validData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10, fill: "#94a3b8" }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tick={{ fontSize: 10, fill: "#94a3b8" }}
            tickLine={false}
            axisLine={false}
            domain={["auto", "auto"]}
            tickFormatter={(v: number) => `${v}${suffix}`}
          />
          <Tooltip
            contentStyle={{
              background: "white",
              border: "1px solid #e2e8f0",
              borderRadius: "8px",
              fontSize: "0.8rem",
            }}
            formatter={(value) => [`${value}${suffix}`, title]}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
