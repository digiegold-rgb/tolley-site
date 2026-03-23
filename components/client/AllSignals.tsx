"use client";

interface Signal {
  id: string;
  signal: string;
  confidence: number;
  title: string;
  reasoning: string;
  scope: string;
  category: string;
  timeHorizon: string | null;
}

const SIGNAL_STYLES: Record<string, { bg: string; color: string; border: string }> = {
  buy: { bg: "rgba(52, 211, 153, 0.1)", color: "#34D399", border: "rgba(52, 211, 153, 0.2)" },
  sell: { bg: "rgba(248, 113, 113, 0.1)", color: "#F87171", border: "rgba(248, 113, 113, 0.2)" },
  hold: { bg: "rgba(201, 168, 76, 0.1)", color: "#E2C97E", border: "rgba(201, 168, 76, 0.2)" },
  watch: { bg: "rgba(139, 142, 191, 0.1)", color: "#B8BAD9", border: "rgba(139, 142, 191, 0.2)" },
};

export function AllSignals({ signals }: { signals: Signal[] }) {
  if (!signals.length) return null;

  return (
    <div>
      <h2 style={{ fontSize: "1.5rem", fontWeight: 800, color: "var(--cl-text)", marginBottom: "0.5rem" }}>
        AI Market Signals
      </h2>
      <p style={{ fontSize: "0.85rem", color: "var(--cl-text-muted)", marginBottom: "1.25rem" }}>
        {signals.length} active signals analyzed from {">"}3,500 data points across KC metro
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "1rem" }}>
        {signals.map((s) => {
          const style = SIGNAL_STYLES[s.signal.toLowerCase()] || SIGNAL_STYLES.watch;
          return (
            <div
              key={s.id}
              className="cl-card"
              style={{ padding: "1.25rem" }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem", marginBottom: "0.75rem" }}>
                <span
                  style={{
                    padding: "4px 12px",
                    borderRadius: "999px",
                    fontSize: "0.7rem",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    background: style.bg,
                    color: style.color,
                    border: `1px solid ${style.border}`,
                  }}
                >
                  {s.signal}
                </span>
                <span style={{ fontSize: "0.7rem", color: "var(--cl-text-light)" }}>
                  {Math.round(s.confidence * 100)}% confidence
                </span>
              </div>
              <div style={{ fontSize: "0.95rem", fontWeight: 600, color: "var(--cl-text)", marginBottom: "0.5rem", lineHeight: 1.4 }}>
                {s.title}
              </div>
              <p style={{ fontSize: "0.8rem", color: "var(--cl-text-muted)", lineHeight: 1.6, marginBottom: "0.75rem" }}>
                {s.reasoning.slice(0, 200)}{s.reasoning.length > 200 ? "…" : ""}
              </p>
              <div style={{ display: "flex", gap: "1rem", fontSize: "0.7rem", color: "var(--cl-text-light)" }}>
                <span style={{ background: "rgba(255,255,255,0.05)", padding: "2px 8px", borderRadius: "4px" }}>
                  {s.category}
                </span>
                <span style={{ background: "rgba(255,255,255,0.05)", padding: "2px 8px", borderRadius: "4px" }}>
                  {s.scope}
                </span>
                {s.timeHorizon && (
                  <span style={{ background: "rgba(255,255,255,0.05)", padding: "2px 8px", borderRadius: "4px" }}>
                    {s.timeHorizon}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
