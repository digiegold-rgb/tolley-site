"use client";

import { useState, useEffect } from "react";

interface StoreDeal {
  item: string;
  cheapStore: string;
  cheapPrice: number;
  expensiveStore: string;
  expensivePrice: number;
  savings: number;
}

interface PriceDrop {
  item: string;
  store: string;
  oldPrice: number;
  newPrice: number;
  dropPercent: number;
}

interface StoreSpend {
  store: string;
  amount: number;
}

interface SavingsData {
  storeBestDeals: StoreDeal[];
  priceDrops: PriceDrop[];
  monthlySpendByStore: StoreSpend[];
}

const MONEY_TIPS = [
  "Buy store-brand for pantry staples — same quality, 20-40% cheaper.",
  "Check the clearance rack for meat approaching its sell-by date and freeze it.",
  "Use Walmart curbside pickup to avoid impulse buys — you'll stick to your list.",
  "Buy in bulk for items you use weekly (rice, pasta, canned goods).",
  "Compare price per ounce, not total price — bigger isn't always cheaper.",
  "Plan meals around what's on sale this week before writing your list.",
  "Freeze bread, milk, and cheese before they expire — they thaw perfectly.",
];

export default function SavingsPage() {
  const [data, setData] = useState<SavingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/food/savings")
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load");
        return r.json();
      })
      .then((d) => setData(d))
      .catch(() => setError("Couldn't load savings data"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div style={{ maxWidth: "900px", margin: "0 auto", padding: "2rem 1.5rem", textAlign: "center" }}>
        <div style={{ fontSize: "3rem", marginBottom: "1rem", animation: "food-fade-up 0.8s ease-in-out infinite alternate" }}>
          {"💰"}
        </div>
        <p style={{ color: "var(--food-text-secondary)" }}>Loading savings insights...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ maxWidth: "900px", margin: "0 auto", padding: "2rem 1.5rem", textAlign: "center" }}>
        <p style={{ color: "#ef4444" }}>{error}</p>
      </div>
    );
  }

  // Empty state
  // Map API response to page interfaces
  const deals: StoreDeal[] = (data?.storeBestDeals || []).map((d: any) => ({
    item: d.item, cheapStore: d.cheapestStore, cheapPrice: d.price,
    expensiveStore: d.expensiveStore, expensivePrice: d.expensivePrice, savings: d.savings,
  }));
  const drops: PriceDrop[] = (data?.priceDrops || []).map((d: any) => ({
    item: d.item, store: d.store, oldPrice: d.previousPrice, newPrice: d.currentPrice,
    dropPercent: d.previousPrice > 0 ? ((d.previousPrice - d.currentPrice) / d.previousPrice) * 100 : 0,
  }));
  const spendByStore: StoreSpend[] = (data?.monthlySpendByStore || []).map((s: any) => ({
    store: s.store, amount: s.total,
  }));
  const totalSavings = deals.reduce((s, d) => s + d.savings, 0);
  const hasData = deals.length > 0 || drops.length > 0 || spendByStore.length > 0;

  if (!hasData) {
    return (
      <div style={{ maxWidth: "900px", margin: "0 auto", padding: "2rem 1.5rem" }}>
        <h1
          className="food-enter"
          style={{ fontSize: "2rem", fontWeight: 700, color: "var(--food-text)", marginBottom: "2rem" }}
        >
          Smart Savings {"💰"}
        </h1>

        <div
          className="food-card food-enter"
          style={{
            padding: "3rem 2rem",
            textAlign: "center",
            "--enter-delay": "0.1s",
          } as React.CSSProperties}
        >
          <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>{"📷"}</div>
          <h3 style={{ fontSize: "1.25rem", fontWeight: 600, color: "var(--food-text)", marginBottom: "0.5rem" }}>
            Scan more receipts to unlock price insights!
          </h3>
          <p style={{ color: "var(--food-text-secondary)", marginBottom: "1.5rem", maxWidth: "400px", margin: "0 auto 1.5rem" }}>
            The more receipts you scan, the better we can track prices across stores and find you savings.
          </p>
          <a href="/food/scan" className="food-btn food-btn-primary food-glow">
            Scan a Receipt
          </a>
        </div>

        {/* Still show tips in empty state */}
        <section
          className="food-enter"
          style={{ marginTop: "2rem", "--enter-delay": "0.2s" } as React.CSSProperties}
        >
          <h2 style={{ fontSize: "1.25rem", fontWeight: 600, color: "var(--food-text)", marginBottom: "1rem" }}>
            {"💡"} Money-Saving Tips
          </h2>
          <div className="food-card" style={{ padding: "1.25rem" }}>
            <ul style={{ margin: 0, paddingLeft: "1.25rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {MONEY_TIPS.map((tip, i) => (
                <li key={i} style={{ color: "var(--food-text)", lineHeight: 1.5 }}>{tip}</li>
              ))}
            </ul>
          </div>
        </section>
      </div>
    );
  }

  const maxSpend = Math.max(...spendByStore.map((s) => s.amount), 1);
  const storeColors = [
    "var(--food-pink)",
    "var(--food-lavender)",
    "var(--food-mint)",
    "var(--food-peach)",
    "var(--food-rose-gold)",
  ];

  return (
    <div style={{ maxWidth: "900px", margin: "0 auto", padding: "2rem 1.5rem" }}>
      <h1
        className="food-enter"
        style={{ fontSize: "2rem", fontWeight: 700, color: "var(--food-text)", marginBottom: "0.5rem" }}
      >
        Smart Savings {"💰"}
      </h1>
      {totalSavings > 0 && (
        <p
          className="food-enter"
          style={{
            color: "var(--food-mint)",
            fontWeight: 600,
            fontSize: "1.0625rem",
            marginBottom: "2rem",
            "--enter-delay": "0.05s",
          } as React.CSSProperties}
        >
          Potential savings: ${totalSavings.toFixed(2)} this month
        </p>
      )}

      {/* Section 1: Best Deals by Store */}
      {deals && deals.length > 0 && (
        <section
          className="food-enter"
          style={{ marginBottom: "2rem", "--enter-delay": "0.1s" } as React.CSSProperties}
        >
          <h2 style={{ fontSize: "1.25rem", fontWeight: 600, color: "var(--food-text)", marginBottom: "1rem" }}>
            {"🏷️"} Best Deals by Store
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {deals.map((deal, i) => (
              <div
                key={i}
                className="food-card food-enter"
                style={{
                  padding: "1rem 1.25rem",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "1rem",
                  "--enter-delay": `${0.15 + i * 0.06}s`,
                } as React.CSSProperties}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 500, color: "var(--food-text)", marginBottom: "0.25rem" }}>
                    {deal.item}
                  </div>
                  <div style={{ fontSize: "0.8125rem", color: "var(--food-text-secondary)" }}>
                    Save ${deal.savings.toFixed(2)} by buying at{" "}
                    <strong style={{ color: "var(--food-mint)" }}>{deal.cheapStore}</strong>
                    {" "}instead of {deal.expensiveStore}
                  </div>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{ fontWeight: 700, color: "var(--food-mint)", fontSize: "1.125rem" }}>
                    ${deal.cheapPrice.toFixed(2)}
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "var(--food-text-secondary)", textDecoration: "line-through" }}>
                    ${deal.expensivePrice.toFixed(2)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Section 2: Price Drops */}
      {drops && drops.length > 0 && (
        <section
          className="food-enter"
          style={{ marginBottom: "2rem", "--enter-delay": "0.25s" } as React.CSSProperties}
        >
          <h2 style={{ fontSize: "1.25rem", fontWeight: 600, color: "var(--food-text)", marginBottom: "1rem" }}>
            {"📉"} Price Drops
          </h2>
          <div className="food-card" style={{ padding: "1.25rem" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {drops.map((drop, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "0.5rem 0",
                    borderBottom: i < drops.length - 1 ? "1px solid var(--food-border)" : "none",
                  }}
                >
                  <div>
                    <span style={{ fontWeight: 500, color: "var(--food-text)" }}>{drop.item}</span>
                    <span style={{ fontSize: "0.8125rem", color: "var(--food-text-secondary)", marginLeft: "0.5rem" }}>
                      at {drop.store}
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <span style={{ color: "var(--food-text-secondary)", textDecoration: "line-through", fontSize: "0.875rem" }}>
                      ${drop.oldPrice.toFixed(2)}
                    </span>
                    <span style={{ color: "var(--food-mint)", fontWeight: 600 }}>
                      {"↓"} ${drop.newPrice.toFixed(2)}
                    </span>
                    <span className="food-tag food-tag-mint">
                      -{Math.round(drop.dropPercent)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Section 3: Monthly Spend by Store */}
      {spendByStore && spendByStore.length > 0 && (
        <section
          className="food-enter"
          style={{ marginBottom: "2rem", "--enter-delay": "0.35s" } as React.CSSProperties}
        >
          <h2 style={{ fontSize: "1.25rem", fontWeight: 600, color: "var(--food-text)", marginBottom: "1rem" }}>
            {"📊"} Monthly Spend by Store
          </h2>
          <div className="food-card" style={{ padding: "1.5rem" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {spendByStore.map((store, i) => {
                const pct = (store.amount / maxSpend) * 100;
                const color = storeColors[i % storeColors.length];
                return (
                  <div key={store.store}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: "0.25rem",
                      }}
                    >
                      <span style={{ fontSize: "0.9375rem", fontWeight: 500, color: "var(--food-text)" }}>
                        {store.store}
                      </span>
                      <span style={{ fontSize: "0.9375rem", fontWeight: 600, color }}>
                        ${store.amount.toFixed(2)}
                      </span>
                    </div>
                    <div
                      style={{
                        height: "0.75rem",
                        borderRadius: "0.375rem",
                        background: "rgba(244, 114, 182, 0.08)",
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          height: "100%",
                          width: `${pct}%`,
                          borderRadius: "0.375rem",
                          background: color,
                          transition: "width 0.6s ease",
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            <div
              style={{
                marginTop: "1rem",
                paddingTop: "1rem",
                borderTop: "1px solid var(--food-border)",
                display: "flex",
                justifyContent: "space-between",
                fontWeight: 600,
                color: "var(--food-text)",
              }}
            >
              <span>Total</span>
              <span>${spendByStore.reduce((s, x) => s + x.amount, 0).toFixed(2)}</span>
            </div>
          </div>
        </section>
      )}

      {/* Section 4: Money-Saving Tips */}
      <section
        className="food-enter"
        style={{ marginBottom: "2rem", "--enter-delay": "0.45s" } as React.CSSProperties}
      >
        <h2 style={{ fontSize: "1.25rem", fontWeight: 600, color: "var(--food-text)", marginBottom: "1rem" }}>
          {"💡"} Money-Saving Tips
        </h2>
        <div className="food-card" style={{ padding: "1.25rem" }}>
          <ul style={{ margin: 0, paddingLeft: "1.25rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {MONEY_TIPS.map((tip, i) => (
              <li key={i} style={{ color: "var(--food-text)", lineHeight: 1.5 }}>{tip}</li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
