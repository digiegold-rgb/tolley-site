"use client";

import { useEffect, useState } from "react";

interface RepriceEvent {
  id: string;
  productId: string | null;
  title: string;
  fromPrice: number;
  toPrice: number;
  status: "dropped" | "gone" | "failed";
  runAt: string;
}

interface ReportData {
  counts: { dropped: number; gone: number; failed: number; totalDiscount: number };
  lastRunAt: string | null;
  events: RepriceEvent[];
}

/**
 * "What dropped overnight" tracker — top of the shop dashboard. Fed by the
 * nightly FB Marketplace repricer (2%/day until sold) via
 * /api/shop/reprice-report.
 */
export function RepriceTracker() {
  const [data, setData] = useState<ReportData | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    fetch("/api/shop/reprice-report?hours=36")
      .then((r) => (r.ok ? r.json() : null))
      .then(setData)
      .catch(() => {});
  }, []);

  if (!data || (data.counts.dropped === 0 && data.counts.gone === 0 && data.counts.failed === 0)) {
    return null;
  }

  const { counts } = data;
  const drops = data.events.filter((e) => e.status === "dropped");
  const lastRun = data.lastRunAt
    ? new Date(data.lastRunAt).toLocaleString("en-US", {
        timeZone: "America/Chicago",
        weekday: "short",
        hour: "numeric",
        minute: "2-digit",
      })
    : null;

  return (
    <div className="mt-4 rounded-xl border border-amber-400/20 bg-amber-500/[0.06] p-4">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <div className="flex items-center gap-3">
          <span className="text-xl">🌙</span>
          <div>
            <p className="text-sm font-semibold text-amber-200">
              Overnight price drops: {counts.dropped} listing{counts.dropped === 1 ? "" : "s"}{" "}
              <span className="font-normal text-amber-200/60">
                (−${counts.totalDiscount} total{counts.gone > 0 ? ` · ${counts.gone} no longer on FB` : ""}
                {counts.failed > 0 ? ` · ${counts.failed} failed` : ""})
              </span>
            </p>
            {lastRun && (
              <p className="text-xs text-white/40">last run {lastRun} · drops 2%/day until sold</p>
            )}
          </div>
        </div>
        <span className="shrink-0 text-xs text-amber-200/70">
          {expanded ? "hide ▲" : "view all ▼"}
        </span>
      </button>

      {expanded && (
        <div className="mt-3 max-h-80 overflow-y-auto rounded-lg border border-white/10">
          <table className="w-full text-sm">
            <tbody>
              {drops.map((e) => (
                <tr key={e.id} className="border-b border-white/5 last:border-0">
                  <td className="px-3 py-1.5 text-white/80">{e.title}</td>
                  <td className="whitespace-nowrap px-3 py-1.5 text-right">
                    <span className="text-white/35 line-through">${Math.round(e.fromPrice)}</span>{" "}
                    <span className="font-semibold text-amber-300">${Math.round(e.toPrice)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
