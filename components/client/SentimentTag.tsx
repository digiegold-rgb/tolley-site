export function SentimentTag({ sentiment }: { sentiment: number | null }) {
  if (sentiment === null || sentiment === undefined) return null;

  let label: string;
  let className: string;

  if (sentiment > 0.2) {
    label = "Bullish";
    className = "cl-sentiment-bullish";
  } else if (sentiment < -0.2) {
    label = "Bearish";
    className = "cl-sentiment-bearish";
  } else {
    label = "Neutral";
    className = "cl-sentiment-neutral";
  }

  return (
    <span
      className={className}
      style={{
        display: "inline-block",
        fontSize: "0.7rem",
        fontWeight: 700,
        padding: "2px 8px",
        borderRadius: "6px",
        textTransform: "uppercase",
        letterSpacing: "0.05em",
      }}
    >
      {label}
    </span>
  );
}
