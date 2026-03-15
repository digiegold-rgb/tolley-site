"use client";

export function MpLeaves() {
  return (
    <div className="pointer-events-none fixed inset-0 z-[3] overflow-hidden">
      {Array.from({ length: 10 }).map((_, i) => (
        <span key={i} className="mp-leaf" />
      ))}
    </div>
  );
}
