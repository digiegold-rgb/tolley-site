"use client";

/**
 * Live dashboard for the Vater pipeline — renders what previously required
 * `watch -n 2 curl localhost:8189/queue` + `nvidia-smi` on the DGX:
 *   - Two ComfyUI instances (interactive :8188 + pipeline :8189) with VRAM bars
 *   - Queue depth per instance
 *   - Any active Vater jobs with phase/progress/lastLog
 *
 * Polls /api/vater/pipeline-status every 3s. Fails quiet — a transient 502
 * while the DGX tunnel hiccups should not flash error toasts.
 */

import { useEffect, useRef, useState } from "react";
import type {
  PipelineActiveJob,
  PipelineInstance,
  PipelineStatus,
} from "@/lib/vater/autopilot-client";

const POLL_INTERVAL_MS = 3000;

export function PipelineLiveStatus() {
  const [status, setStatus] = useState<PipelineStatus | null>(null);
  const [errored, setErrored] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    let cancelled = false;

    const poll = async () => {
      try {
        const res = await fetch("/api/vater/pipeline-status", {
          cache: "no-store",
        });
        if (!res.ok) {
          if (!cancelled) setErrored(true);
          return;
        }
        const data = (await res.json()) as PipelineStatus;
        if (!cancelled) {
          setStatus(data);
          setErrored(false);
        }
      } catch {
        if (!cancelled) setErrored(true);
      }
    };

    void poll();
    const id = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      mountedRef.current = false;
      clearInterval(id);
    };
  }, []);

  if (!status && !errored) {
    return (
      <div className="rounded-xl border border-sky-500/15 bg-sky-500/[0.03] px-4 py-3 text-xs text-slate-500">
        Loading pipeline status…
      </div>
    );
  }

  if (errored && !status) {
    return (
      <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.05] px-4 py-3 text-xs text-amber-200/90">
        Pipeline status unreachable — DGX tunnel may be down.
      </div>
    );
  }

  const primary = status?.instances.primary;
  const vater = status?.instances.vater;
  const jobs = status?.activeJobs ?? [];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {primary && <InstanceCard label="ComfyUI :8188 — interactive" inst={primary} />}
        {vater && <InstanceCard label="ComfyUI :8189 — Vater" inst={vater} highlight />}
      </div>
      {jobs.length > 0 && (
        <div className="rounded-xl border border-sky-500/20 bg-slate-950/60 p-3">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-sky-300/80">
            Active jobs
          </div>
          <div className="space-y-2">
            {jobs.map((job) => (
              <ActiveJobRow key={job.jobId} job={job} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function InstanceCard({
  label,
  inst,
  highlight = false,
}: {
  label: string;
  inst: PipelineInstance;
  highlight?: boolean;
}) {
  const total = inst.vramTotalGb ?? 128;
  const free = inst.vramFreeGb ?? 0;
  const used = Math.max(0, total - free);
  const pct = Math.min(100, Math.max(0, (used / total) * 100));
  const running = inst.queueRunning ?? 0;
  const pending = inst.queuePending ?? 0;
  const busy = (running ?? 0) > 0;

  return (
    <div
      className={`rounded-xl border p-3 text-xs ${
        highlight
          ? "border-sky-500/30 bg-sky-500/[0.06]"
          : "border-white/10 bg-slate-950/50"
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="font-medium text-slate-200">{label}</div>
        <div className="flex items-center gap-2">
          <span
            className={`inline-block h-2 w-2 rounded-full ${
              inst.healthy ? (busy ? "bg-amber-400 animate-pulse" : "bg-emerald-400") : "bg-red-500"
            }`}
          />
          <span className="text-[11px] text-slate-400">
            {inst.healthy ? (busy ? "busy" : "idle") : "offline"}
          </span>
        </div>
      </div>
      <div className="mt-2">
        <div className="flex items-baseline justify-between text-[11px] text-slate-400">
          <span>VRAM</span>
          <span className="font-mono text-slate-300">
            {used.toFixed(1)} / {total.toFixed(0)} GB
          </span>
        </div>
        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-white/5">
          <div
            className={`h-full transition-all duration-500 ${
              pct > 85 ? "bg-red-500" : pct > 65 ? "bg-amber-400" : "bg-emerald-500"
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
        <span>
          queue: <span className="font-mono text-slate-300">{running} running</span>
          {pending > 0 ? (
            <span className="font-mono text-slate-500"> · {pending} pending</span>
          ) : null}
        </span>
        {inst.comfyVersion && (
          <span className="font-mono text-[10px] text-slate-600">
            v{inst.comfyVersion}
          </span>
        )}
      </div>
    </div>
  );
}

function ActiveJobRow({ job }: { job: PipelineActiveJob }) {
  const pct = Math.min(100, Math.max(0, job.progress));
  return (
    <div className="rounded-lg border border-white/5 bg-black/30 px-3 py-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-[11px]">
            <span className="font-mono text-slate-400">{job.jobId.slice(0, 8)}</span>
            <span className="rounded-full border border-sky-500/30 bg-sky-500/10 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-sky-300">
              {job.kind}
            </span>
            <span className="text-[10px] text-slate-500">{job.phase}</span>
          </div>
          {job.lastLog && (
            <div className="mt-1 truncate font-mono text-[11px] text-slate-400">
              {job.lastLog}
            </div>
          )}
        </div>
        <div className="shrink-0 text-right">
          <div className="font-mono text-xs text-slate-300">{pct}%</div>
        </div>
      </div>
      <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-white/5">
        <div
          className="h-full bg-gradient-to-r from-sky-500 to-cyan-400 transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
