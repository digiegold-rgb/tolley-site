import * as React from "react";

export function Panel({
  title,
  right,
  children,
  className = "",
}: {
  title: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-xl bg-white/[0.03] border border-white/10 p-5 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-white/60">{title}</h3>
        {right && <div className="text-xs text-white/40">{right}</div>}
      </div>
      {children}
    </div>
  );
}

export function StatCard({
  label,
  value,
  prev,
  color,
  format,
  hint,
}: {
  label: string;
  value: number | string;
  prev?: number;
  color?: "default" | "purple" | "red" | "green" | "amber";
  format?: (n: number) => string;
  hint?: string;
}) {
  const num = typeof value === "number";
  const display = num ? (format ? format(value as number) : (value as number).toLocaleString()) : value;
  const growth =
    num && prev !== undefined && prev > 0
      ? Math.round((((value as number) - prev) / prev) * 100)
      : null;

  const accents: Record<string, string> = {
    purple: "border-purple-500/15 bg-purple-500/[0.04]",
    red: "border-red-500/15 bg-red-500/[0.04]",
    green: "border-emerald-500/15 bg-emerald-500/[0.04]",
    amber: "border-amber-500/15 bg-amber-500/[0.04]",
    default: "border-white/10 bg-white/[0.03]",
  };
  const text: Record<string, string> = {
    purple: "text-purple-400",
    red: "text-red-400",
    green: "text-emerald-400",
    amber: "text-amber-400",
    default: "text-white",
  };
  const c = color ?? "default";

  return (
    <div className={`rounded-xl border ${accents[c]} p-4 text-center`}>
      <div className={`text-2xl font-bold tabular-nums ${text[c]}`}>{display}</div>
      <div className="text-[0.65rem] text-white/40 mt-1">{label}</div>
      {growth !== null && growth !== 0 && (
        <div
          className={`text-[0.6rem] mt-1 font-medium ${
            growth > 0 ? "text-emerald-400" : "text-red-400"
          }`}
        >
          {growth > 0 ? "↑" : "↓"}
          {Math.abs(growth)}%
        </div>
      )}
      {hint && <div className="text-[0.55rem] text-white/30 mt-0.5">{hint}</div>}
    </div>
  );
}
