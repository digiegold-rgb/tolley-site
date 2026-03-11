"use client";

export function JjSparks() {
  return (
    <div className="pointer-events-none fixed inset-0 z-[3] overflow-hidden">
      {Array.from({ length: 12 }).map((_, i) => (
        <span key={i} className="jj-spark" />
      ))}
    </div>
  );
}
