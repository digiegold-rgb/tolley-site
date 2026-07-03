"use client";

/**
 * YouTubeImportTracker — Apple Notes–style rolling import tracker.
 *
 * Two stacked boxes on the right side of the Transcribe tab:
 *   1. Recent (3 lines): the 3 most-recent imports with status emojis (⏳ ✅ ❌)
 *      and a retry button on failed items.
 *   2. Queue (4 lines): URLs lined up by the user, processed serially.
 *
 * Concurrency: the tracker submits one URL at a time. While anything is
 * mid-pipeline (status in IN_FLIGHT_STATUSES), new pastes go to the queue.
 * When the active import finishes, the next queued URL auto-submits.
 *
 * Persistence: the queue is mirrored to localStorage so a refresh doesn't
 * lose pending pastes. Active list rebuilds itself from the projects array.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  IN_FLIGHT_STATUSES,
  STATUS_LABELS,
  type YouTubeProjectStatus,
} from "@/lib/vater/youtube-status";
import { useToast } from "@/components/ui/Toast";

interface YouTubeProject {
  id: string;
  sourceUrl: string | null;
  sourceTitle: string | null;
  status: string;
  errorMessage: string | null;
  createdAt: string;
}

interface QueuedItem {
  id: string;
  url: string;
  addedAt: number;
}

interface Props {
  projects: YouTubeProject[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onCreated: (project: any) => void;
}

const YT_RE =
  /^https?:\/\/(www\.)?(youtube\.com\/(watch\?v=|shorts\/)|youtu\.be\/)/;
const QUEUE_STORAGE_KEY = "vater-import-queue";
const QUEUE_MAX = 4;
const ACTIVE_MAX = 3;

export function YouTubeImportTracker({ projects, onCreated }: Props) {
  const { toast } = useToast();
  const [queue, setQueue] = useState<QueuedItem[]>([]);
  const [pasteValue, setPasteValue] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const dequeueLockRef = useRef(false);

  // Hydrate queue from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(QUEUE_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setQueue(parsed.slice(0, QUEUE_MAX));
      }
    } catch {
      // ignore corrupt cache
    }
  }, []);

  // Persist queue on every change
  useEffect(() => {
    try {
      localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(queue));
    } catch {
      // ignore quota errors
    }
  }, [queue]);

  // Active = top 3 most recent projects from any source
  const active = projects.slice(0, ACTIVE_MAX);

  // Anything mid-pipeline blocks queue dequeue
  const hasInFlight =
    submitting ||
    projects.some((p) =>
      IN_FLIGHT_STATUSES.has(p.status as YouTubeProjectStatus),
    );

  const submitUrl = useCallback(
    async (url: string) => {
      setSubmitting(true);
      try {
        const res = await fetch("/api/vater/youtube", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data.error || "Failed to import");
        }
        onCreated(data.project);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Something went wrong";
        toast({
          variant: "error",
          title: "Import failed",
          description: msg,
        });
      } finally {
        setSubmitting(false);
      }
    },
    [onCreated, toast],
  );

  // Auto-dequeue: when nothing is in-flight and queue has items, pop next
  useEffect(() => {
    if (hasInFlight) return;
    if (queue.length === 0) return;
    if (dequeueLockRef.current) return;
    dequeueLockRef.current = true;
    const [next, ...rest] = queue;
    setQueue(rest);
    submitUrl(next.url).finally(() => {
      dequeueLockRef.current = false;
    });
  }, [hasInFlight, queue, submitUrl]);

  const handlePasteSubmit = () => {
    const url = pasteValue.trim();
    if (!YT_RE.test(url)) {
      toast({ variant: "error", title: "Invalid YouTube URL" });
      return;
    }
    setPasteValue("");
    if (hasInFlight || queue.length > 0) {
      if (queue.length >= QUEUE_MAX) {
        toast({
          variant: "warning",
          title: `Queue full (${QUEUE_MAX} max)`,
          description: "Wait for one to finish before adding more.",
        });
        return;
      }
      setQueue((q) => [
        ...q,
        { id: crypto.randomUUID(), url, addedAt: Date.now() },
      ]);
    } else {
      submitUrl(url);
    }
  };

  const handleRetry = (project: YouTubeProject) => {
    if (!project.sourceUrl) {
      toast({ variant: "error", title: "Cannot retry — no source URL" });
      return;
    }
    if (hasInFlight) {
      if (queue.length >= QUEUE_MAX) {
        toast({ variant: "warning", title: "Queue full — try later" });
        return;
      }
      setQueue((q) => [
        ...q,
        {
          id: crypto.randomUUID(),
          url: project.sourceUrl!,
          addedAt: Date.now(),
        },
      ]);
      toast({ variant: "default", title: "Queued retry" });
    } else {
      submitUrl(project.sourceUrl);
    }
  };

  const removeFromQueue = (id: string) => {
    setQueue((q) => q.filter((item) => item.id !== id));
  };

  const queueMode = hasInFlight || queue.length > 0;

  return (
    <div className="vater-card p-4">
      {/* Paste field (top, full width) */}
      <div className="flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900/50 px-3 py-2">
        <span className="text-lg">📺</span>
        <input
          type="url"
          value={pasteValue}
          onChange={(e) => setPasteValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handlePasteSubmit()}
          placeholder="Paste YouTube URL..."
          className="flex-1 bg-transparent text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none"
        />
        <button
          onClick={handlePasteSubmit}
          disabled={!pasteValue.trim()}
          className={`rounded-lg px-5 py-1.5 text-sm font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-40 ${
            queueMode
              ? "bg-amber-500/20 text-amber-300 hover:bg-amber-500/30"
              : "bg-sky-500/20 text-sky-300 hover:bg-sky-500/30"
          }`}
        >
          {queueMode ? "Queue" : "Import"}
        </button>
      </div>

      {/* Recent + Queue side by side */}
      <div className="mt-3 grid grid-cols-2 gap-3">
        {/* Recent */}
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-2.5">
          <div className="mb-1.5 flex items-center justify-between">
            <h3 className="text-[10px] font-bold uppercase tracking-wider text-emerald-400/80">
              ⚡ Recent
            </h3>
            {submitting && (
              <span className="text-[10px] text-sky-400 animate-pulse">
                submitting…
              </span>
            )}
          </div>
          <div className="space-y-1">
            {Array.from({ length: ACTIVE_MAX }).map((_, i) => {
              const project = active[i];
              if (!project) {
                return (
                  <div
                    key={`empty-active-${i}`}
                    className="h-7 rounded-md border border-dashed border-zinc-800/50"
                  />
                );
              }
              return (
                <ActiveRow
                  key={project.id}
                  project={project}
                  onRetry={() => handleRetry(project)}
                />
              );
            })}
          </div>
        </div>

        {/* Queue */}
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-2.5">
          <div className="mb-1.5 flex items-center justify-between">
            <h3 className="text-[10px] font-bold uppercase tracking-wider text-amber-400/80">
              ⏳ Queue
            </h3>
            <span className="text-[10px] font-semibold text-zinc-400">
              {queue.length}/{QUEUE_MAX}
            </span>
          </div>
          <div className="space-y-1">
            {Array.from({ length: QUEUE_MAX }).map((_, i) => {
              const item = queue[i];
              if (!item) {
                return (
                  <div
                    key={`empty-queue-${i}`}
                    className="h-7 rounded-md border border-dashed border-zinc-800/50"
                  />
                );
              }
              return (
                <QueueRow
                  key={item.id}
                  item={item}
                  onRemove={() => removeFromQueue(item.id)}
                />
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Row sub-components
// ---------------------------------------------------------------------------

function ActiveRow({
  project,
  onRetry,
}: {
  project: YouTubeProject;
  onRetry: () => void;
}) {
  const status = project.status as YouTubeProjectStatus;
  const isFailed = status === "failed";
  const isInFlight = IN_FLIGHT_STATUSES.has(status);
  const emoji = isFailed ? "❌" : isInFlight ? "⏳" : "✅";
  const label = STATUS_LABELS[status] ?? status;
  const display =
    project.sourceTitle?.trim() || project.sourceUrl?.trim() || "(no URL)";

  const rowClass = isFailed
    ? "border-red-500/40 bg-red-500/10"
    : isInFlight
      ? "border-sky-500/40 bg-sky-500/5 animate-pulse"
      : "border-emerald-500/40 bg-emerald-500/5";
  const textClass = isFailed
    ? "text-red-200"
    : isInFlight
      ? "text-sky-200"
      : "text-emerald-200";

  const retryHoverClass = isFailed
    ? "text-red-300 hover:bg-red-500/20 hover:text-amber-300"
    : isInFlight
      ? "text-sky-300/70 hover:bg-sky-500/20 hover:text-sky-200"
      : "text-emerald-300/70 hover:bg-emerald-500/20 hover:text-emerald-200";
  const retryTitle = isFailed
    ? "Retry this failed import"
    : isInFlight
      ? "Re-queue this URL (creates a fresh project)"
      : "Redo with a fresh generation";

  return (
    <div
      className={`group flex h-7 items-center gap-2 rounded-md border px-2 ${rowClass}`}
      title={`${label}${project.errorMessage ? ` — ${project.errorMessage}` : ""}`}
    >
      <span className="text-sm leading-none">{emoji}</span>
      <span className={`flex-1 truncate text-xs font-medium ${textClass}`}>
        {display}
      </span>
      <button
        onClick={onRetry}
        aria-label={retryTitle}
        title={retryTitle}
        className={`rounded p-0.5 transition-colors ${retryHoverClass}`}
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M3 12a9 9 0 1 0 3-6.7" />
          <path d="M3 4v5h5" />
        </svg>
      </button>
    </div>
  );
}

function QueueRow({
  item,
  onRemove,
}: {
  item: QueuedItem;
  onRemove: () => void;
}) {
  return (
    <div className="group flex h-7 items-center gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 px-2">
      <span className="text-sm leading-none">⏸</span>
      <span className="flex-1 truncate text-xs font-medium text-amber-200/90">
        {item.url}
      </span>
      <button
        onClick={onRemove}
        aria-label="Remove from queue"
        title="Remove from queue"
        className="rounded p-0.5 text-amber-300/60 hover:bg-red-500/20 hover:text-red-300"
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  );
}
