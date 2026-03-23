export function SignalBadge({
  signal,
  confidence,
  title,
  large = false,
}: {
  signal: string;
  confidence: number;
  title?: string;
  large?: boolean;
}) {
  const badgeClass =
    signal === "BUY"
      ? "cl-badge-buy"
      : signal === "SELL"
        ? "cl-badge-sell"
        : signal === "HOLD"
          ? "cl-badge-hold"
          : "cl-badge-watch";

  return (
    <div
      className={`cl-card`}
      style={{ padding: large ? "1.25rem" : "1rem" }}
    >
      {title && (
        <div
          style={{
            fontSize: "0.75rem",
            fontWeight: 600,
            color: "var(--cl-text-muted)",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            marginBottom: "8px",
          }}
        >
          Primary Signal
        </div>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <span
          className={badgeClass}
          style={{
            display: "inline-block",
            padding: large ? "6px 16px" : "4px 12px",
            borderRadius: "8px",
            fontSize: large ? "1.25rem" : "0.85rem",
            fontWeight: 800,
            letterSpacing: "0.08em",
          }}
        >
          {signal}
        </span>
        <div style={{ flex: 1 }}>
          {title && (
            <div
              style={{
                fontSize: "0.8rem",
                fontWeight: 500,
                color: "var(--cl-text)",
                marginBottom: "4px",
              }}
            >
              {title}
            </div>
          )}
          {/* Confidence bar */}
          <div
            style={{
              height: "6px",
              borderRadius: "3px",
              background: "#e2e8f0",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${confidence}%`,
                borderRadius: "3px",
                background:
                  signal === "BUY"
                    ? "var(--cl-positive)"
                    : signal === "SELL"
                      ? "var(--cl-negative)"
                      : "var(--cl-accent)",
                transition: "width 1s ease",
              }}
            />
          </div>
          <div
            style={{
              fontSize: "0.7rem",
              color: "var(--cl-text-light)",
              marginTop: "2px",
            }}
          >
            {confidence.toFixed(0)}% confidence
          </div>
        </div>
      </div>
    </div>
  );
}
