"use client";

export function TrendArrow({
  value,
  size = 14,
}: {
  value: number;
  size?: number;
}) {
  if (value === 0) return <span className="cl-trend-up">—</span>;

  const isUp = value > 0;
  return (
    <span className={isUp ? "cl-trend-up" : "cl-trend-down"}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 16 16"
        fill="none"
        style={{
          display: "inline-block",
          verticalAlign: "middle",
          transform: isUp ? "none" : "rotate(180deg)",
        }}
      >
        <path
          d="M8 3L13 9H3L8 3Z"
          fill="currentColor"
        />
      </svg>
    </span>
  );
}
