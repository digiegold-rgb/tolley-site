"use client";

import { useState } from "react";
import type { ScanActivityItem, ScannerName } from "@/lib/scan/types";

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

const SCANNER_COLORS: Record<ScannerName, string> = {
  leads: "text-green-400",
  arbitrage: "text-blue-400",
  products: "text-cyan-400",
  unclaimed: "text-yellow-400",
  markets: "text-purple-400",
};

export default function ScanActivityFeed({
  activities,
}: {
  activities: ScanActivityItem[];
}) {
  const [filter, setFilter] = useState<ScannerName | "all">("all");

  const filtered =
    filter === "all"
      ? activities
      : activities.filter((a) => a.scanner === filter);

  return (
    <div className="scan-card p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-white/80">Activity Feed</h3>
        <div className="flex gap-1">
          {(["all", "leads", "arbitrage", "products", "unclaimed", "markets"] as const).map(
            (f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`scan-period-btn ${filter === f ? "scan-period-active" : ""}`}
              >
                {f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1, 4)}
              </button>
            )
          )}
        </div>
      </div>

      <div className="space-y-0.5 max-h-[400px] overflow-y-auto pr-1">
        {filtered.length === 0 ? (
          <div className="text-center py-8 text-white/20 text-xs">
            No activity yet. Scanners will populate this feed as they run.
          </div>
        ) : (
          filtered.map((item) => (
            <div
              key={item.id}
              className={`scan-feed-item scan-feed-${item.severity} py-2 flex items-start gap-3`}
            >
              <span className="text-[0.65rem] text-white/20 shrink-0 w-16 text-right tabular-nums">
                {formatTime(item.createdAt)}
              </span>
              <span className={`text-[0.65rem] shrink-0 ${SCANNER_COLORS[item.scanner]}`}>
                [{item.scanner}]
              </span>
              <span className="text-xs text-white/60 leading-tight">
                {item.title}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
