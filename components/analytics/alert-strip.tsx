"use client";

import { useTabData } from "./shared/hooks";
import type { AlertsResponse } from "./shared/types";

export default function AlertStrip() {
  const { data } = useTabData<AlertsResponse>("/api/analytics/alerts", {
    autoRefreshMs: 5 * 60_000,
  });

  if (!data || data.alerts.length === 0) return null;

  return (
    <div className="sticky top-0 z-40 -mx-4 mb-4 px-4 py-2 bg-[#0a0612]/95 backdrop-blur border-b border-white/10">
      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-[0.65rem] uppercase tracking-wide text-white/40 mr-1">
          Alerts ({data.alerts.length})
        </span>
        {data.alerts.map((a) => {
          const cls =
            a.severity === "red"
              ? "border-red-500/40 bg-red-500/10 text-red-200"
              : "border-amber-500/40 bg-amber-500/10 text-amber-200";
          const dot = a.severity === "red" ? "bg-red-500" : "bg-amber-500";
          return (
            <a
              key={a.id}
              href={a.href ?? "#systems"}
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[0.65rem] font-medium transition hover:bg-white/[0.02] ${cls}`}
              title={a.detail ?? ""}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${dot} animate-pulse`} />
              <span className="font-semibold">{a.title}</span>
              {a.detail && <span className="text-white/60 hidden sm:inline">· {a.detail}</span>}
            </a>
          );
        })}
      </div>
    </div>
  );
}
