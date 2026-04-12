"use client";

/**
 * Live step indicator for the run-creation pipeline.
 *
 * Reads CREATION_PHASES + IN_FLIGHT_STATUSES from lib/vater/youtube-status.ts.
 * Polls /api/vater/youtube/[id]/poll every 3s while status is in-flight.
 * Surfaces project.errorMessage with a Retry button on failed.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  CREATION_PHASES,
  IN_FLIGHT_STATUSES,
  STATUS_LABELS,
  type CreationPhase,
  type YouTubeProjectStatus,
} from "@/lib/vater/youtube-status";

interface ProjectShape {
  id: string;
  status: string;
  progress: number;
  mode: string | null;
  errorMessage: string | null;
  updatedAt: string;
  // Poll route surfaces recent log lines under stepDetails.logs — opaque Json in
  // Prisma, so we keep it unknown here and narrow at the read site.
  stepDetails: unknown;
}

function extractRecentLogs(stepDetails: unknown): string[] {
  if (!stepDetails || typeof stepDetails !== "object") return [];
  const logs = (stepDetails as { logs?: unknown }).logs;
  if (!Array.isArray(logs)) return [];
  return logs.filter((l): l is string => typeof l === "string");
}

interface Props {
  project: ProjectShape;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onUpdate: (project: any) => void;
}

const POLL_INTERVAL_MS = 3000;

export function YouTubeCreationProgress({ project, onUpdate }: Props) {
  const status = project.status as YouTubeProjectStatus;
  const isInFlight = IN_FLIGHT_STATUSES.has(status);
  const isFailed = status === "failed";
  const isReady = status === "ready";
  const isTopicMode = (project.mode || "transcribe") === "topic";

  const [retrying, setRetrying] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const startedAtRef = useRef<number>(Date.now());

  // Reset elapsed counter when status changes
  useEffect(() => {
    startedAtRef.current = new Date(project.updatedAt).getTime() || Date.now();
    setElapsedMs(Date.now() - startedAtRef.current);
  }, [project.updatedAt]);

  // Tick the elapsed counter every second while in-flight
  useEffect(() => {
    if (!isInFlight) return;
    const id = setInterval(() => {
      setElapsedMs(Date.now() - startedAtRef.current);
    }, 1000);
    return () => clearInterval(id);
  }, [isInFlight]);

  // Poll the project while in-flight
  const pollOnce = useCallback(async () => {
    try {
      const res = await fetch(`/api/vater/youtube/${project.id}/poll`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.project) onUpdate(data.project);
    } catch {
      // ignore — next tick will retry
    }
  }, [project.id, onUpdate]);

  useEffect(() => {
    if (!isInFlight) return;
    const id = setInterval(pollOnce, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [isInFlight, pollOnce]);

  const handleRetry = async () => {
    setRetrying(true);
    try {
      // Re-poll to pick up any state change first
      await pollOnce();
    } finally {
      setRetrying(false);
    }
  };

  // Filter out transcribe-only phases when in topic mode
  const visiblePhases: readonly CreationPhase[] = isTopicMode
    ? CREATION_PHASES.filter((p) => !p.transcribeOnly)
    : CREATION_PHASES;

  const currentIndex = visiblePhases.findIndex((p) => p.status === status);

  const phaseState = (idx: number): "done" | "active" | "pending" => {
    if (isReady) return "done";
    if (currentIndex === -1) return "pending";
    if (idx < currentIndex) return "done";
    if (idx === currentIndex) return "active";
    return "pending";
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-zinc-200">
            {isReady
              ? "Pipeline complete"
              : isFailed
                ? "Pipeline failed"
                : STATUS_LABELS[status] || status}
          </p>
          <p className="text-[10px] text-zinc-600">
            {isInFlight ? `Elapsed ${formatElapsed(elapsedMs)}` : null}
          </p>
        </div>
        <span className="text-xs font-mono text-zinc-500">
          {project.progress}%
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 overflow-hidden rounded-full bg-zinc-800">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            isFailed
              ? "bg-red-500/60"
              : isReady
                ? "bg-emerald-500/60"
                : "bg-sky-500/60"
          }`}
          style={{ width: `${Math.max(2, Math.min(100, project.progress))}%` }}
        />
      </div>

      {/* Live log feed — last 4 lines from the DGX worker. Fixed height so
          the rest of the UI doesn't reflow as lines arrive. */}
      <LiveLogFeed lines={extractRecentLogs(project.stepDetails)} />


      {/* Phase list */}
      <ol className="space-y-2">
        {visiblePhases.map((phase, idx) => {
          const state = phaseState(idx);
          return (
            <li
              key={phase.status}
              className={`flex items-start gap-3 rounded-lg border p-3 transition-all ${
                state === "active"
                  ? "border-sky-400/40 bg-sky-400/5"
                  : state === "done"
                    ? "border-emerald-500/20 bg-emerald-500/5"
                    : "border-zinc-800 bg-zinc-900/30 opacity-60"
              }`}
            >
              <span className="mt-0.5 w-4 shrink-0 text-center">
                {state === "done" ? (
                  <span className="text-emerald-400">✓</span>
                ) : state === "active" ? (
                  <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-sky-400" />
                ) : (
                  <span className="inline-block h-2 w-2 rounded-full bg-zinc-700" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-zinc-200">
                  {phase.label}
                </p>
                <p className="mt-0.5 text-[10px] text-zinc-500">
                  {phase.description}
                </p>
              </div>
            </li>
          );
        })}
      </ol>

      {/* Failed banner + retry */}
      {isFailed && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4">
          <p className="text-xs font-semibold text-red-400">Pipeline failed</p>
          {project.errorMessage && (
            <p className="mt-1 break-words font-mono text-[10px] text-red-300">
              {project.errorMessage}
            </p>
          )}
          <button
            type="button"
            onClick={handleRetry}
            disabled={retrying}
            className="mt-3 rounded-lg bg-red-500/20 px-4 py-1.5 text-xs font-semibold text-red-400 hover:bg-red-500/30 disabled:opacity-50"
          >
            {retrying ? "Re-checking..." : "Re-check status"}
          </button>
        </div>
      )}
    </div>
  );
}

function formatElapsed(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

/**
 * Shows the last few log lines emitted by the DGX worker for this job.
 * The poll route stuffs them into `project.stepDetails.logs`; we pick the
 * tail here. Fixed height (4 rows) so the panel never reflows.
 */
function LiveLogFeed({ lines }: { lines: string[] }) {
  const tail = lines.slice(-4);
  // Pad with placeholders so the panel height stays constant even with zero logs.
  const rows: (string | null)[] = [...tail];
  while (rows.length < 4) rows.unshift(null);

  return (
    <div className="rounded-md border border-zinc-800 bg-black/60 px-3 py-2 font-mono text-[10px] leading-5 text-zinc-400">
      <div className="mb-1 flex items-center justify-between text-[9px] uppercase tracking-wider text-zinc-600">
        <span>DGX worker</span>
        <span>{tail.length ? `last ${tail.length} lines` : "waiting…"}</span>
      </div>
      {rows.map((row, idx) => (
        <div
          key={idx}
          className="truncate"
          // Latest line highlighted so the eye lands on it
          style={{ opacity: row ? (idx === rows.length - 1 ? 1 : 0.5 + idx * 0.15) : 0.15 }}
        >
          {row ?? "·"}
        </div>
      ))}
    </div>
  );
}
