"use client";

import type { ScannerState } from "@/lib/scan/types";

function formatTimeAgo(iso: string | null): string {
  if (!iso) return "Never";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const STATUS_LABELS: Record<string, string> = {
  running: "Running",
  idle: "Idle",
  error: "Error",
  paused: "Paused",
};

export default function ScanStatusCard({
  scanner,
  statLine,
}: {
  scanner: ScannerState;
  statLine: string;
}) {
  return (
    <div className="scan-card p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={`scan-dot scan-dot-${scanner.status}`} />
          <span className="text-sm font-semibold text-white/90">
            {scanner.label}
          </span>
        </div>
        <span className="text-[0.65rem] text-white/30">
          {STATUS_LABELS[scanner.status] ?? scanner.status}
        </span>
      </div>

      <div className="text-lg font-bold scan-stat-green mb-1">{statLine}</div>

      <div className="flex items-center justify-between text-[0.65rem] text-white/25">
        <span>Last: {formatTimeAgo(scanner.lastRun)}</span>
        <span>Schedule: {scanner.nextRun}</span>
      </div>

      {scanner.error && (
        <div className="mt-2 text-[0.6rem] text-red-400/70 truncate">
          {scanner.error}
        </div>
      )}
    </div>
  );
}
