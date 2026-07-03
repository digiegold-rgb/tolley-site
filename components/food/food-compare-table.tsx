"use client";

import { useEffect, useState } from "react";

interface CompareRow {
  normalizedName: string;
  displayName: string;
  walmartPrice: number | null;
  samsPrice: number | null;
  recentBuys: number;
  winner: "walmart" | "samsclub" | "tie" | null;
  savingsPerUnit: number | null;
  estimatedAnnualSavings: number;
}

interface CompareData {
  both: CompareRow[];
  walmartOnly: CompareRow[];
  samsOnly: CompareRow[];
  summary: {
    itemsCompared: number;
    samsWins: number;
    walmartWins: number;
    totalAnnualSavings: number;
  };
}

function fmtPrice(n: number | null): string {
  return n == null ? "—" : `$${n.toFixed(2)}`;
}

export default function FoodCompareTable() {
  const [data, setData] = useState<CompareData | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/food/compare", { cache: "no-store" });
        if (!res.ok) throw new Error(`status ${res.status}`);
        setData(await res.json());
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Failed to load comparison");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div className="food-card" style={{ padding: "2rem", textAlign: "center", color: "var(--food-text-secondary)" }}>
        Loading comparison…
      </div>
    );
  }
  if (err) {
    return (
      <div className="food-card" style={{ padding: "1.5rem", color: "#c2410c" }}>
        {err}
      </div>
    );
  }
  if (!data) return null;

  const empty =
    data.both.length === 0 && data.walmartOnly.length === 0 && data.samsOnly.length === 0;

  if (empty) {
    return (
      <div className="food-card" style={{ padding: "2rem", textAlign: "center" }}>
        <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>⚖️</div>
        <h3 style={{ fontSize: "1.125rem", fontWeight: 600, marginBottom: "0.5rem" }}>
          No purchase data yet
        </h3>
        <p style={{ color: "var(--food-text-secondary)", fontSize: "0.875rem" }}>
          Sync from Walmart and Sam&apos;s Club on the <a href="/food/scan" style={{ color: "var(--food-pink)", textDecoration: "underline" }}>Scan page</a>, then come back.
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {/* Summary */}
      <div
        className="food-card"
        style={{ padding: "1.25rem", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "0.75rem" }}
      >
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--food-text)" }}>
            {data.summary.itemsCompared}
          </div>
          <div style={{ fontSize: "0.75rem", color: "var(--food-text-secondary)" }}>Items compared</div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--food-mint, #047857)" }}>
            {data.summary.samsWins}
          </div>
          <div style={{ fontSize: "0.75rem", color: "var(--food-text-secondary)" }}>Sam&apos;s wins</div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--food-pink)" }}>
            {data.summary.walmartWins}
          </div>
          <div style={{ fontSize: "0.75rem", color: "var(--food-text-secondary)" }}>Walmart wins</div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--food-text)" }}>
            ${data.summary.totalAnnualSavings.toFixed(0)}
          </div>
          <div style={{ fontSize: "0.75rem", color: "var(--food-text-secondary)" }}>
            Est. yearly savings if you switched
          </div>
        </div>
      </div>

      {/* Side-by-side */}
      {data.both.length > 0 && (
        <div className="food-card" style={{ padding: "1.25rem" }}>
          <h3 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "0.875rem" }}>
            Same item, both stores ({data.both.length})
          </h3>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", fontSize: "0.875rem", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "1px solid var(--food-border)", color: "var(--food-text-secondary)", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  <th style={{ padding: "0.5rem 0.5rem 0.5rem 0" }}>Item</th>
                  <th style={{ padding: "0.5rem", textAlign: "right" }}>Walmart</th>
                  <th style={{ padding: "0.5rem", textAlign: "right" }}>Sam&apos;s</th>
                  <th style={{ padding: "0.5rem", textAlign: "right" }}>Winner</th>
                  <th style={{ padding: "0.5rem", textAlign: "right" }}>Yearly $</th>
                </tr>
              </thead>
              <tbody>
                {data.both.map((row) => (
                  <tr key={row.normalizedName} style={{ borderBottom: "1px solid var(--food-border)" }}>
                    <td style={{ padding: "0.625rem 0.5rem 0.625rem 0", color: "var(--food-text)" }}>
                      {row.displayName}
                    </td>
                    <td
                      style={{
                        padding: "0.625rem 0.5rem",
                        textAlign: "right",
                        fontWeight: row.winner === "walmart" ? 700 : 400,
                        color: row.winner === "walmart" ? "var(--food-pink)" : "var(--food-text)",
                      }}
                    >
                      {fmtPrice(row.walmartPrice)}
                    </td>
                    <td
                      style={{
                        padding: "0.625rem 0.5rem",
                        textAlign: "right",
                        fontWeight: row.winner === "samsclub" ? 700 : 400,
                        color: row.winner === "samsclub" ? "#047857" : "var(--food-text)",
                      }}
                    >
                      {fmtPrice(row.samsPrice)}
                    </td>
                    <td style={{ padding: "0.625rem 0.5rem", textAlign: "right", fontSize: "0.75rem" }}>
                      {row.winner === "samsclub" && <span style={{ color: "#047857" }}>Sam&apos;s</span>}
                      {row.winner === "walmart" && <span style={{ color: "var(--food-pink)" }}>Walmart</span>}
                      {row.winner === "tie" && <span style={{ color: "var(--food-text-secondary)" }}>tie</span>}
                    </td>
                    <td style={{ padding: "0.625rem 0.5rem", textAlign: "right", color: "var(--food-text-secondary)", fontSize: "0.8125rem" }}>
                      {row.estimatedAnnualSavings > 0 ? `$${row.estimatedAnnualSavings.toFixed(2)}` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p style={{ fontSize: "0.75rem", color: "var(--food-text-secondary)", marginTop: "0.625rem" }}>
            Yearly $ = price gap × your 90-day purchase frequency, projected to 12 months. Conservative estimate.
          </p>
        </div>
      )}

      {/* Single-store sections */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1rem" }}>
        {data.samsOnly.length > 0 && (
          <div className="food-card" style={{ padding: "1.25rem" }}>
            <h3 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "0.625rem" }}>
              Only at Sam&apos;s ({data.samsOnly.length})
            </h3>
            <p style={{ fontSize: "0.75rem", color: "var(--food-text-secondary)", marginBottom: "0.625rem" }}>
              You buy these at Sam&apos;s and we haven&apos;t seen them at Walmart yet.
            </p>
            <ul style={{ display: "flex", flexDirection: "column", gap: "0.375rem", fontSize: "0.875rem" }}>
              {data.samsOnly.slice(0, 15).map((r) => (
                <li key={r.normalizedName} style={{ display: "flex", justifyContent: "space-between", color: "var(--food-text)" }}>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>{r.displayName}</span>
                  <span style={{ color: "var(--food-text-secondary)", marginLeft: "0.5rem" }}>{fmtPrice(r.samsPrice)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {data.walmartOnly.length > 0 && (
          <div className="food-card" style={{ padding: "1.25rem" }}>
            <h3 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "0.625rem" }}>
              Only at Walmart ({data.walmartOnly.length})
            </h3>
            <p style={{ fontSize: "0.75rem", color: "var(--food-text-secondary)", marginBottom: "0.625rem" }}>
              You buy these at Walmart and we haven&apos;t seen them at Sam&apos;s yet.
            </p>
            <ul style={{ display: "flex", flexDirection: "column", gap: "0.375rem", fontSize: "0.875rem" }}>
              {data.walmartOnly.slice(0, 15).map((r) => (
                <li key={r.normalizedName} style={{ display: "flex", justifyContent: "space-between", color: "var(--food-text)" }}>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>{r.displayName}</span>
                  <span style={{ color: "var(--food-text-secondary)", marginLeft: "0.5rem" }}>{fmtPrice(r.walmartPrice)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <p style={{ fontSize: "0.75rem", color: "var(--food-text-secondary)", textAlign: "center" }}>
        Heads up: cross-brand matches (Great Value vs Member&apos;s Mark) aren&apos;t auto-merged yet. v2 will let you mark equivalent products.
      </p>
    </div>
  );
}
