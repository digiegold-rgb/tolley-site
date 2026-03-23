"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { useMemo } from "react";

interface SpendingDataPoint {
  date: string;
  amount: number;
  store: string;
}

interface FoodSpendingChartProps {
  data: SpendingDataPoint[];
  period: string;
}

const CHART_COLORS = [
  "#f472b6", // pink
  "#c084fc", // lavender
  "#6ee7b7", // mint
  "#fdba74", // peach
  "#e8b4b8", // rose-gold
  "#a78bfa", // violet
];

export function FoodSpendingChart({ data, period }: FoodSpendingChartProps) {
  // Aggregate by date
  const chartData = useMemo(() => {
    const byDate = data.reduce<Record<string, number>>((acc, d) => {
      acc[d.date] = (acc[d.date] || 0) + d.amount;
      return acc;
    }, {});

    return Object.entries(byDate)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, amount]) => ({
        date: new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        amount: Math.round(amount * 100) / 100,
      }));
  }, [data]);

  // Store breakdown
  const storeBreakdown = useMemo(() => {
    const byStore = data.reduce<Record<string, number>>((acc, d) => {
      const store = d.store || "Other";
      acc[store] = (acc[store] || 0) + d.amount;
      return acc;
    }, {});

    return Object.entries(byStore)
      .sort(([, a], [, b]) => b - a)
      .map(([store, amount], i) => ({
        store,
        amount: Math.round(amount * 100) / 100,
        color: CHART_COLORS[i % CHART_COLORS.length],
      }));
  }, [data]);

  const totalSpent = data.reduce((sum, d) => sum + d.amount, 0);

  return (
    <div className="food-enter">
      {/* Summary */}
      <div style={{ display: "flex", alignItems: "baseline", gap: "1rem", marginBottom: "1.5rem" }}>
        <div>
          <div style={{ fontSize: "0.8125rem", color: "var(--food-text-secondary)" }}>Total Spent ({period})</div>
          <div style={{ fontSize: "2rem", fontWeight: 700, color: "var(--food-pink)" }}>
            ${totalSpent.toFixed(2)}
          </div>
        </div>
      </div>

      {/* Bar Chart */}
      {chartData.length > 0 ? (
        <div className="food-card" style={{ padding: "1rem" }}>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fill: "#9c6b8a" }}
                axisLine={{ stroke: "rgba(244, 114, 182, 0.2)" }}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "#9c6b8a" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `$${v}`}
              />
              <Tooltip
                contentStyle={{
                  background: "white",
                  border: "1px solid rgba(244, 114, 182, 0.2)",
                  borderRadius: "0.75rem",
                  fontSize: "0.875rem",
                  boxShadow: "0 4px 15px rgba(244, 114, 182, 0.15)",
                }}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                formatter={((value: number) => [`$${value.toFixed(2)}`, "Spent"]) as any}
              />
              <Bar dataKey="amount" radius={[6, 6, 0, 0]}>
                {chartData.map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div style={{ textAlign: "center", padding: "3rem 1rem", color: "var(--food-text-secondary)" }}>
          <div style={{ fontSize: "2.5rem", marginBottom: "0.5rem" }}>📊</div>
          <p>No spending data for this period</p>
        </div>
      )}

      {/* Store Breakdown */}
      {storeBreakdown.length > 0 && (
        <div style={{ marginTop: "1.5rem" }}>
          <h3 style={{ fontSize: "1rem", fontWeight: 600, color: "var(--food-text)", marginBottom: "0.75rem" }}>
            By Store
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {storeBreakdown.map((s) => (
              <div key={s.store} style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                <div
                  style={{
                    width: "12px",
                    height: "12px",
                    borderRadius: "3px",
                    background: s.color,
                    flexShrink: 0,
                  }}
                />
                <span style={{ flex: 1, fontSize: "0.875rem", color: "var(--food-text)" }}>{s.store}</span>
                <span style={{ fontSize: "0.875rem", fontWeight: 500, color: "var(--food-text)" }}>
                  ${s.amount.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
