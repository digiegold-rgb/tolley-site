"use client";

interface DigestData {
  headline: string;
  keyChanges: { metric: string; from: number; to: number; direction: string }[];
  riskFactors: { factor: string; severity: string; description: string }[];
  opportunities: { opportunity: string; confidence: number; reasoning: string }[];
  date: string;
}

export function DailyBriefing({ digest }: { digest: DigestData | null }) {
  if (!digest) return null;

  return (
    <div>
      <h2 style={{ fontSize: "1.5rem", fontWeight: 800, color: "var(--cl-text)", marginBottom: "0.5rem" }}>
        Daily AI Briefing
      </h2>
      <p style={{ fontSize: "0.75rem", color: "var(--cl-text-light)", marginBottom: "1rem" }}>
        {new Date(digest.date).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
      </p>

      {/* Headline */}
      <div className="cl-card" style={{ padding: "1.5rem", marginBottom: "1rem" }}>
        <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--cl-text)", lineHeight: 1.5 }}>
          {digest.headline}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "1rem" }}>
        {/* Key Changes */}
        {digest.keyChanges?.length > 0 && (
          <div className="cl-card" style={{ padding: "1.25rem" }}>
            <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--cl-gold)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.75rem" }}>
              Key Changes
            </div>
            {digest.keyChanges.map((c, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid rgba(255,255,255,0.04)", fontSize: "0.85rem" }}>
                <span style={{ color: "var(--cl-text-muted)" }}>{c.metric}</span>
                <span style={{ color: c.direction === "up" ? "var(--cl-positive)" : c.direction === "down" ? "var(--cl-negative)" : "var(--cl-text-light)", fontWeight: 600 }}>
                  {c.direction === "up" ? "↑" : c.direction === "down" ? "↓" : "→"} {typeof c.to === "number" ? c.to : c.to}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Opportunities */}
        {digest.opportunities?.length > 0 && (
          <div className="cl-card" style={{ padding: "1.25rem" }}>
            <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--cl-positive)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.75rem" }}>
              Opportunities
            </div>
            {digest.opportunities.map((o, i) => (
              <div key={i} style={{ padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--cl-text)", marginBottom: "4px" }}>{o.opportunity}</div>
                <div style={{ fontSize: "0.75rem", color: "var(--cl-text-muted)", lineHeight: 1.5 }}>{o.reasoning}</div>
              </div>
            ))}
          </div>
        )}

        {/* Risk Factors */}
        {digest.riskFactors?.length > 0 && (
          <div className="cl-card" style={{ padding: "1.25rem" }}>
            <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--cl-negative)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.75rem" }}>
              Risk Factors
            </div>
            {digest.riskFactors.map((r, i) => (
              <div key={i} style={{ padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                  <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--cl-text)" }}>{r.factor}</span>
                  <span style={{
                    padding: "1px 6px",
                    borderRadius: "4px",
                    fontSize: "0.6rem",
                    fontWeight: 700,
                    background: r.severity === "high" ? "rgba(248,113,113,0.15)" : "rgba(201,168,76,0.12)",
                    color: r.severity === "high" ? "#F87171" : "#E2C97E",
                  }}>
                    {r.severity}
                  </span>
                </div>
                <div style={{ fontSize: "0.75rem", color: "var(--cl-text-muted)", lineHeight: 1.5 }}>{r.description}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
