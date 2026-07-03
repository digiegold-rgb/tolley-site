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
  const [cancelling, setCancelling] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const startedAtRef = useRef<number>(Date.now());

  const handleCancel = async () => {
    const confirmed = window.confirm(
      "⛔ Cancel this project?\n\n" +
        "• The DGX worker will stop at the next pipeline stage boundary.\n" +
        "• The project will roll back to the \"Needs context\" state so you can " +
        "edit your goal/duration/style and restart from principles.\n" +
        "• All work done so far (transcript, partial script, any scenes " +
        "already generated) is preserved on disk.\n\n" +
        "Click OK to kill.",
    );
    if (!confirmed) return;
    setCancelling(true);
    try {
      const res = await fetch(`/api/vater/youtube/${project.id}/cancel`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error ?? `HTTP ${res.status}`);
      }
      if (data.project) onUpdate(data.project);
    } catch (err) {
      // Minimal error feedback — parent may surface a toast separately.
      // eslint-disable-next-line no-alert
      alert(
        "Cancel failed: " +
          (err instanceof Error ? err.message : String(err)),
      );
    } finally {
      setCancelling(false);
    }
  };

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
          <p className="text-[10px] text-zinc-400">
            {isInFlight ? `Elapsed ${formatElapsed(elapsedMs)}` : null}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Kill button — visible only while the pipeline is running. Worker
              stops at next stage boundary, project status flips back to
              transcribed so the user can re-edit the context form. */}
          {isInFlight && (
            <button
              type="button"
              onClick={handleCancel}
              disabled={cancelling}
              title="Stop this project and restart from principles"
              className="rounded-md border border-rose-500/50 bg-rose-500/10 px-3 py-1.5 text-[11px] font-semibold text-rose-300 shadow-[0_0_8px_rgba(244,63,94,0.25)] transition-all hover:border-rose-400 hover:bg-rose-500/20 hover:shadow-[0_0_14px_rgba(244,63,94,0.45)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {cancelling ? "Cancelling…" : "⛔ Kill"}
            </button>
          )}
          <span className="text-xs font-mono text-zinc-400">
            {project.progress}%
          </span>
        </div>
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


      {/* Phase list. The ACTIVE step gets:
          - a neon-sky border + glow ring so it's visually obvious
          - a "ripple" dot indicator (two pulsing rings) so the user knows
            the pipeline is alive even when stdout is quiet
          - slightly brighter copy */}
      <ol className="space-y-2">
        {visiblePhases.map((phase, idx) => {
          const state = phaseState(idx);
          const active = state === "active";
          return (
            <li
              key={phase.status}
              className={`flex items-start gap-3 rounded-lg border p-3 transition-all ${
                active
                  ? "border-sky-400/60 bg-sky-400/10 shadow-[0_0_14px_rgba(56,189,248,0.30)] ring-1 ring-sky-400/30"
                  : state === "done"
                    ? "border-emerald-500/30 bg-emerald-500/5"
                    : "border-zinc-800 bg-zinc-900/30 opacity-60"
              }`}
            >
              <span className="relative mt-1 flex h-3 w-3 shrink-0 items-center justify-center">
                {state === "done" ? (
                  <span className="text-sm text-emerald-400">✓</span>
                ) : active ? (
                  <>
                    {/* Double-ripple heartbeat — soft outer ring expands while
                        the solid inner dot blinks, creates an unmistakable
                        "alive" signal. */}
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-400 opacity-75" />
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.8)]" />
                  </>
                ) : (
                  <span className="inline-block h-2 w-2 rounded-full bg-zinc-700" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p
                  className={`text-xs font-semibold ${
                    active ? "text-sky-200" : "text-zinc-200"
                  }`}
                >
                  {phase.label}
                  {active && (
                    <span className="ml-2 inline-flex items-center text-[9px] font-normal uppercase tracking-[0.15em] text-sky-300/80">
                      <span className="mr-1 inline-block h-1 w-1 animate-pulse rounded-full bg-sky-300" />
                      live · {formatElapsed(elapsedMs)}
                    </span>
                  )}
                </p>
                <p
                  className={`mt-0.5 text-[10px] ${
                    active ? "text-sky-200/90" : "text-zinc-300"
                  }`}
                >
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
