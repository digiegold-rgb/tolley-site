"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

interface SpendingData {
  period: string;
  amount: number;
  store?: string;
}

interface TopExpense {
  name: string;
  totalSpent: number;
  count: number;
}

interface StoreBreakdown {
  store: string;
  total: number;
  visits: number;
}

type DateRange = "week" | "month" | "3months" | "all";

const DATE_RANGES: { key: DateRange; label: string }[] = [
  { key: "week", label: "Last Week" },
  { key: "month", label: "Last Month" },
  { key: "3months", label: "Last 3 Months" },
  { key: "all", label: "All Time" },
];

export default function AnalyticsPage() {
  const [dateRange, setDateRange] = useState<DateRange>("3months");
  const [spending, setSpending] = useState<SpendingData[]>([]);
  const [topExpenses, setTopExpenses] = useState<TopExpense[]>([]);
  const [storeBreakdown, setStoreBreakdown] = useState<StoreBreakdown[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalSpent, setTotalSpent] = useState(0);
  const [error, setError] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/food/analytics/spending?range=${dateRange}`);
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        setError(errData.error || `API error ${res.status}`);
        return;
      }
      const data = await res.json();
      setSpending(data.spending || []);
      setTopExpenses(data.topExpenses || []);
      setStoreBreakdown(data.storeBreakdown || []);
      setTotalSpent(data.totalSpent || 0);
    } catch (e) {
      setError("Failed to load analytics");
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const maxSpending = Math.max(...spending.map((s) => s.amount), 1);
  const maxStoreTotal = Math.max(...storeBreakdown.map((s) => s.total), 1);
  const STORE_COLORS = ["var(--food-pink)", "var(--food-lavender)", "var(--food-mint)", "var(--food-peach)", "var(--food-rose-gold)"];

  if (loading) {
    return (
      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "4rem 1.5rem", textAlign: "center" }}>
        <div style={{ fontSize: "2.5rem" }}>📊</div>
        <p style={{ color: "var(--food-text-secondary)", marginTop: "1rem" }}>Loading analytics...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "2rem 1.5rem" }}>
        <h1 style={{ fontSize: "1.75rem", fontWeight: 700, color: "var(--food-text)", marginBottom: "1.5rem" }}>
          Spending Analytics
        </h1>
        <div className="food-card" style={{ padding: "2rem", textAlign: "center" }}>
          <p style={{ color: "#ef4444", marginBottom: "1rem" }}>{error}</p>
          {error.includes("Unauthorized") && (
            <Link href="/login?callbackUrl=/food/analytics" className="food-btn food-btn-primary">Sign In</Link>
          )}
          {error.includes("No household") && (
            <Link href="/food/settings" className="food-btn food-btn-primary">Set Up Kitchen</Link>
          )}
          <button className="food-btn food-btn-secondary" onClick={fetchData} style={{ marginLeft: "0.5rem" }}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  const rangeLabel = dateRange === "week" ? "this week" : dateRange === "month" ? "this month" : dateRange === "3months" ? "last 3 months" : "all time";

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", padding: "2rem 1.5rem" }}>
      {/* Header */}
      <div className="food-enter" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.5rem", flexWrap: "wrap", gap: "1rem" }}>
        <h1 style={{ fontSize: "1.75rem", fontWeight: 700, color: "var(--food-text)" }}>
          Spending Analytics
        </h1>
        <div style={{ display: "flex", gap: "0.375rem" }}>
          {DATE_RANGES.map((r) => (
            <button
              key={r.key}
              className={`food-tag ${dateRange === r.key ? "food-tag-pink" : ""}`}
              onClick={() => setDateRange(r.key)}
              style={{ cursor: "pointer", border: "1px solid var(--food-border)", background: dateRange === r.key ? "rgba(244, 114, 182, 0.15)" : "white", padding: "0.375rem 0.75rem", fontSize: "0.8125rem" }}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Total spent */}
      <div className="food-card food-enter" style={{ padding: "1.5rem", textAlign: "center", marginBottom: "1.5rem", "--enter-delay": "0.1s" } as React.CSSProperties}>
        <div style={{ fontSize: "0.8125rem", color: "var(--food-text-secondary)", marginBottom: "0.25rem" }}>Total Spent</div>
        <div style={{ fontSize: "2.5rem", fontWeight: 700, color: "var(--food-pink)" }}>${totalSpent.toFixed(2)}</div>
        <div style={{ fontSize: "0.8125rem", color: "var(--food-text-secondary)" }}>{rangeLabel}</div>
      </div>

      {/* Spending bar chart */}
      {spending.length > 0 && (
        <div className="food-card food-enter" style={{ padding: "1.25rem", marginBottom: "1.5rem", "--enter-delay": "0.15s" } as React.CSSProperties}>
          <h2 style={{ fontSize: "1.125rem", fontWeight: 600, color: "var(--food-text)", marginBottom: "1rem" }}>
            Spending Over Time
          </h2>
          <div style={{ display: "flex", alignItems: "flex-end", gap: "4px", height: 160, paddingBottom: "1.5rem", position: "relative" }}>
            {spending.map((s, i) => (
              <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", height: "100%", justifyContent: "flex-end" }}>
                <div
                  style={{
                    width: "100%", maxWidth: 40,
                    height: `${(s.amount / maxSpending) * 100}%`,
                    minHeight: s.amount > 0 ? 4 : 0,
                    background: "linear-gradient(180deg, var(--food-pink), var(--food-lavender))",
                    borderRadius: "4px 4px 0 0", position: "relative",
                  }}
                  title={`$${s.amount.toFixed(2)} at ${s.store}`}
                >
                  {s.amount > 0 && (
                    <div style={{ position: "absolute", top: "-1.25rem", left: "50%", transform: "translateX(-50%)", fontSize: "0.625rem", color: "var(--food-text-secondary)", whiteSpace: "nowrap" }}>
                      ${s.amount.toFixed(0)}
                    </div>
                  )}
                </div>
                <div style={{ fontSize: "0.5625rem", color: "var(--food-text-secondary)", marginTop: "0.375rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 50 }}>
                  {s.period.slice(5)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "1.5rem" }}>
        {/* Top expenses */}
        <div className="food-card food-enter" style={{ padding: "1.25rem", "--enter-delay": "0.2s" } as React.CSSProperties}>
          <h2 style={{ fontSize: "1.125rem", fontWeight: 600, color: "var(--food-text)", marginBottom: "1rem" }}>Top Expenses</h2>
          {topExpenses.length === 0 ? (
            <p style={{ color: "var(--food-text-secondary)", fontSize: "0.875rem", textAlign: "center", padding: "1rem" }}>
              No spending data yet. <Link href="/food/scan" style={{ color: "var(--food-pink)" }}>Scan a receipt</Link>
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {topExpenses.slice(0, 10).map((item, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.5rem 0", borderBottom: "1px solid rgba(244, 114, 182, 0.08)" }}>
                  <div>
                    <span style={{ fontWeight: 500, color: "var(--food-text)", fontSize: "0.875rem" }}>{item.name}</span>
                    <span style={{ fontSize: "0.75rem", color: "var(--food-text-secondary)", marginLeft: "0.375rem" }}>({item.count}x)</span>
                  </div>
                  <span style={{ fontWeight: 600, color: "var(--food-pink)", fontSize: "0.875rem" }}>${item.totalSpent.toFixed(2)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Store breakdown */}
        <div className="food-card food-enter" style={{ padding: "1.25rem", "--enter-delay": "0.25s" } as React.CSSProperties}>
          <h2 style={{ fontSize: "1.125rem", fontWeight: 600, color: "var(--food-text)", marginBottom: "1rem" }}>By Store</h2>
          {storeBreakdown.length === 0 ? (
            <p style={{ color: "var(--food-text-secondary)", fontSize: "0.875rem", textAlign: "center", padding: "1rem" }}>No store data yet</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {storeBreakdown.map((store, i) => (
                <div key={i}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.25rem" }}>
                    <span style={{ fontSize: "0.875rem", fontWeight: 500, color: "var(--food-text)" }}>{store.store}</span>
                    <span style={{ fontSize: "0.875rem", fontWeight: 600, color: STORE_COLORS[i % STORE_COLORS.length] }}>${store.total.toFixed(2)}</span>
                  </div>
                  <div style={{ height: 8, borderRadius: 4, background: "rgba(244, 114, 182, 0.1)", overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${(store.total / maxStoreTotal) * 100}%`, borderRadius: 4, background: STORE_COLORS[i % STORE_COLORS.length], transition: "width 0.3s ease" }} />
                  </div>
                  <div style={{ fontSize: "0.6875rem", color: "var(--food-text-secondary)", marginTop: "0.125rem" }}>
                    {store.visits} visit{store.visits !== 1 ? "s" : ""}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Empty state */}
      {spending.length === 0 && topExpenses.length === 0 && (
        <div className="food-card food-enter" style={{ textAlign: "center", padding: "4rem 2rem", marginTop: "1.5rem", "--enter-delay": "0.15s" } as React.CSSProperties}>
          <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>📊</div>
          <h3 style={{ fontSize: "1.25rem", fontWeight: 600, color: "var(--food-text)", marginBottom: "0.5rem" }}>No spending data yet</h3>
          <p style={{ color: "var(--food-text-secondary)", marginBottom: "1.5rem" }}>Start scanning receipts to track your grocery spending!</p>
          <Link href="/food/scan" className="food-btn food-btn-primary">Scan a Receipt</Link>
        </div>
      )}
    </div>
  );
}
