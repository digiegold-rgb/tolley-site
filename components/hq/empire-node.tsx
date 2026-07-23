"use client";

// Empire Map node card — n8n-style anatomy: icon + name + status dot top-right,
// mono "✓ working · ran 3h ago" bottom row. Forked pattern from
// components/trading/WorkflowBase.tsx (do NOT edit that file — trading uses it).

import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import type { EmpireStatus } from "@/lib/empire-catalog";

export const NODE_W = 224;
export const NODE_H = 76;

export interface EmpireFlowNodeData {
  label: string;
  icon: string;
  accent: string; // lane accent color
  status: EmpireStatus;
  statusWord: string;
  timeText: string; // "ran 3h ago" | "not built" | …
  flash: boolean; // one-shot ring when status changed on refresh
  [key: string]: unknown;
}

export const STATUS_CONFIG: Record<
  EmpireStatus,
  { color: string; label: string; symbol: string; dotClass: string; glow?: string }
> = {
  working: { color: "#22c55e", label: "working", symbol: "✓", dotClass: "empire-dot-pulse", glow: "0 0 12px rgba(34,197,94,0.45)" },
  running: { color: "#38bdf8", label: "running", symbol: "●", dotClass: "" },
  stale: { color: "#f59e0b", label: "stale", symbol: "◐", dotClass: "" },
  broken: { color: "#ef4444", label: "broken", symbol: "✗", dotClass: "empire-dot-breathe", glow: "0 0 14px rgba(239,68,68,0.5)" },
  missing: { color: "#4b5563", label: "missing", symbol: "○", dotClass: "" },
  paused: { color: "#4b5563", label: "paused", symbol: "⏸", dotClass: "" },
  killed: { color: "#4b5563", label: "killed", symbol: "✕", dotClass: "" },
};

export function relTime(iso: string | null): string {
  if (!iso) return "never";
  const mins = Math.round((Date.now() - Date.parse(iso)) / 60000);
  if (Number.isNaN(mins)) return "never";
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const h = Math.round(mins / 60);
  if (h < 48) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

const handleClass = "!bg-[#1e2733] !border-[#2a3646] !w-2 !h-2";

export function EmpireNodeComponent({ data, selected }: NodeProps<Node<EmpireFlowNodeData>>) {
  const cfg = STATUS_CONFIG[data.status];
  const dimmed = data.status === "killed" || data.status === "missing" || data.status === "paused";

  return (
    <div className={data.flash ? "empire-flash" : undefined}>
      <Handle type="target" position={Position.Left} className={handleClass} />
      <div
        className="rounded-lg transition-colors"
        style={{
          width: NODE_W,
          height: NODE_H,
          background: "#111722",
          border: `1px solid ${selected ? cfg.color : "#1e2733"}`,
          borderLeft: `3px solid ${dimmed ? "#2a3646" : data.accent}`,
          boxShadow: !dimmed && cfg.glow ? cfg.glow : "none",
          opacity: dimmed ? 0.55 : 1,
        }}
      >
        <div className="flex h-full flex-col justify-between px-3 py-2.5">
          <div className="flex items-start justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <span className="text-base leading-none">{data.icon}</span>
              <span className="truncate text-[13px] font-semibold text-[#e5edf5]">{data.label}</span>
            </div>
            <span
              className={`mt-0.5 inline-block h-2.5 w-2.5 shrink-0 rounded-full ${cfg.dotClass}`}
              style={{ background: cfg.color, boxShadow: !dimmed && cfg.glow ? cfg.glow : "none" }}
            />
          </div>
          <div className="truncate font-mono text-[10px] leading-none" style={{ color: cfg.color }}>
            {cfg.symbol} {data.statusWord}
            <span className="text-[#7a8699]"> · {data.timeText}</span>
          </div>
        </div>
      </div>
      <Handle type="source" position={Position.Right} className={handleClass} />
    </div>
  );
}

// Lane background band — rendered as a non-interactive node behind the cards.
export interface EmpireLaneNodeData {
  label: string;
  accent: string;
  width: number;
  height: number;
  rollup: EmpireStatus; // worst child status → header dot
  counts: string; // "2 broken · 1 stale · 8 working"
  [key: string]: unknown;
}

export function EmpireLaneComponent({ data }: NodeProps<Node<EmpireLaneNodeData>>) {
  const cfg = STATUS_CONFIG[data.rollup];
  return (
    <div
      className="rounded-xl"
      style={{
        width: data.width,
        height: data.height,
        background: "rgba(17,23,34,0.35)",
        border: "1px solid #141c28",
        borderLeft: `3px solid ${data.accent}`,
      }}
    >
      <div className="flex items-center gap-2.5 px-4 pt-2.5">
        <span className="font-mono text-[11px] font-bold tracking-[0.18em]" style={{ color: data.accent }}>
          {data.label}
        </span>
        <span className={`inline-block h-2 w-2 rounded-full ${cfg.dotClass}`} style={{ background: cfg.color }} />
        <span className="font-mono text-[9.5px] text-[#7a8699]">{data.counts}</span>
      </div>
    </div>
  );
}
