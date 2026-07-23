"use client";

// Empire Map detail drawer — slides in from the right inside the dark island
// when a node is clicked. Shows status, timing, metrics, and the raw signal.

import { useEffect } from "react";
import type { EmpireNodeDef, EmpireLane } from "@/lib/empire-catalog";
import type { EmpireNodeHealth } from "@/lib/empire-map";
import { STATUS_CONFIG, relTime } from "@/components/hq/empire-node";

interface EmpireDrawerProps {
  def: EmpireNodeDef;
  lane: EmpireLane;
  health: EmpireNodeHealth | undefined;
  onClose: () => void;
}

export function EmpireDrawer({ def, lane, health, onClose }: EmpireDrawerProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const status = health?.status ?? "missing";
  const cfg = STATUS_CONFIG[status];

  return (
    <div
      className="absolute inset-y-0 right-0 z-20 flex w-[340px] max-w-[85%] flex-col overflow-y-auto border-l border-[#1e2733] bg-[#0d131c]/95 backdrop-blur-md"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 border-b border-[#1e2733] px-4 py-3.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="text-2xl leading-none">{def.icon}</span>
          <div className="min-w-0">
            <div className="truncate text-[15px] font-bold text-[#e5edf5]">{def.label}</div>
            <div className="mt-0.5 font-mono text-[9.5px] tracking-[0.14em]" style={{ color: lane.accent }}>
              {lane.owner.toUpperCase()} · {def.kind.toUpperCase()}
            </div>
          </div>
        </div>
        <button
          onClick={onClose}
          className="rounded-md border border-[#1e2733] px-2 py-1 text-xs text-[#7a8699] hover:border-[#2a3646] hover:text-[#e5edf5]"
          aria-label="Close"
        >
          ✕
        </button>
      </div>

      <div className="flex flex-col gap-4 px-4 py-4">
        {/* Status badge */}
        <div
          className="flex items-center gap-2.5 rounded-lg border px-3 py-2.5"
          style={{ borderColor: `${cfg.color}44`, background: `${cfg.color}12` }}
        >
          <span className={`inline-block h-3 w-3 rounded-full ${cfg.dotClass}`} style={{ background: cfg.color }} />
          <span className="font-mono text-sm font-bold uppercase tracking-wider" style={{ color: cfg.color }}>
            {cfg.symbol} {cfg.label}
          </span>
        </div>

        {/* Timing */}
        <div className="space-y-1.5">
          <Row label="Last activity" value={health?.lastRun ? `${relTime(health.lastRun)} — ${new Date(health.lastRun).toLocaleString("en-US", { timeZone: "America/Chicago", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })} CT` : "never seen"} />
          {def.cadenceMin ? <Row label="Expected every" value={formatCadence(def.cadenceMin)} /> : null}
          <Row label="Detail" value={health?.detail ?? "no health data"} />
        </div>

        {/* Metrics */}
        {health?.metrics?.length ? (
          <div>
            <SectionTitle>Metrics</SectionTitle>
            <div className="space-y-1.5">
              {health.metrics.map((m, i) => (
                <Row key={i} label={m.label} value={m.value} />
              ))}
            </div>
          </div>
        ) : null}

        {/* Static context */}
        {def.note ? (
          <div>
            <SectionTitle>Notes</SectionTitle>
            <p className="text-xs leading-relaxed text-[#9aa7b8]">{def.note}</p>
          </div>
        ) : null}

        {/* Raw signal */}
        <div>
          <SectionTitle>Signal</SectionTitle>
          <code className="block break-all rounded-md border border-[#1e2733] bg-[#0a0e14] px-2.5 py-2 font-mono text-[10.5px] text-[#7a8699]">
            {def.signal}
          </code>
        </div>

        {def.href ? (
          <a
            href={def.href}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg border border-[#1f6f5c] bg-[#1f6f5c]/15 px-3 py-2 text-center text-xs font-semibold text-[#2dd4a7] hover:bg-[#1f6f5c]/30"
          >
            Open →
          </a>
        ) : null}
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-1.5 font-mono text-[9.5px] font-bold uppercase tracking-[0.18em] text-[#4b5b6e]">{children}</div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 text-xs">
      <span className="shrink-0 text-[#7a8699]">{label}</span>
      <span className="text-right font-mono text-[11px] text-[#cdd8e4]">{value}</span>
    </div>
  );
}

function formatCadence(min: number): string {
  if (min < 60) return `${min} min`;
  if (min < 1440) return `${Math.round(min / 60)}h`;
  const d = Math.round(min / 1440);
  return d === 1 ? "day" : `${d} days`;
}
