export function BrightCard({
  children,
  className = "",
  hover = true,
  style,
}: {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={`${hover ? "cl-card" : "cl-card-static"} ${className}`}
      style={{ padding: "1.5rem", ...style }}
    >
      {children}
    </div>
  );
}
