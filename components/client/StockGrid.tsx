"use client";

import { TrendArrow } from "./TrendArrow";

const HOUSING_TICKERS = [
  "XHB",
  "ITB",
  "NAIL",
  "DHI",
  "LEN",
  "TOL",
  "PHM",
  "NVR",
  "KBH",
];

interface TickerData {
  price: number;
  change: number;
  changePercent: number;
}

export function StockGrid({
  tickers,
}: {
  tickers: Record<string, TickerData>;
}) {
  const available = HOUSING_TICKERS.filter((t) => tickers[t]);

  if (!available.length) return null;

  return (
    <div>
      <h3
        style={{
          fontSize: "1rem",
          fontWeight: 700,
          color: "var(--cl-text)",
          marginBottom: "0.75rem",
        }}
      >
        Housing Stocks
      </h3>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
          gap: "0.75rem",
        }}
      >
        {available.map((symbol) => {
          const t = tickers[symbol];
          return (
            <div
              key={symbol}
              className="cl-card"
              style={{ padding: "0.75rem", textAlign: "center" }}
            >
              <div
                style={{
                  fontSize: "0.75rem",
                  fontWeight: 700,
                  color: "var(--cl-text-muted)",
                  letterSpacing: "0.05em",
                }}
              >
                {symbol}
              </div>
              <div
                style={{
                  fontSize: "1.1rem",
                  fontWeight: 800,
                  color: "var(--cl-text)",
                  marginTop: "4px",
                }}
              >
                ${t.price.toFixed(2)}
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "4px",
                  marginTop: "2px",
                  fontSize: "0.75rem",
                }}
              >
                <TrendArrow value={t.changePercent} size={10} />
                <span
                  style={{
                    color:
                      t.changePercent >= 0
                        ? "var(--cl-positive)"
                        : "var(--cl-negative)",
                    fontWeight: 600,
                  }}
                >
                  {t.changePercent >= 0 ? "+" : ""}
                  {t.changePercent.toFixed(2)}%
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
