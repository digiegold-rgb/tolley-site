"use client";

// Shimmer placeholder rows/cards shown while a tab's data loads.
// The shimmer keyframes are injected once (inline styles can't declare @keyframes).
export function Skeleton({ rows = 3, height = 120, grid = false }: { rows?: number; height?: number; grid?: boolean }) {
  const items = Array.from({ length: rows });
  return (
    <>
      <style>{`@keyframes action-shimmer { 0% { background-position: -400px 0; } 100% { background-position: 400px 0; } }`}</style>
      <div style={grid
        ? { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px,1fr))", gap: 12 }
        : { display: "flex", flexDirection: "column", gap: 8 }}>
        {items.map((_, i) => (
          <div key={i} style={{
            height, borderRadius: 12, border: "1px solid rgba(255,255,255,0.06)",
            background: "linear-gradient(90deg, rgba(255,255,255,0.04) 25%, rgba(255,255,255,0.09) 50%, rgba(255,255,255,0.04) 75%)",
            backgroundSize: "800px 100%", animation: "action-shimmer 1.4s linear infinite",
          }} />
        ))}
      </div>
    </>
  );
}
