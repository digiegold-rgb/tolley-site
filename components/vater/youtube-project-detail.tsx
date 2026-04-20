"use client";

/**
 * Project detail panel for the VATER YouTube tubegen rebuild.
 *
 * Replaces the old 5-step OpenManus UI. Routes the project into one of:
 *   - draft / fetching / transcribing → progress
 *   - transcribed                      → context form
 *   - in-flight statuses               → creation progress
 *   - ready                            → final player
 *   - failed                           → error + retry
 */

import {
  IN_FLIGHT_STATUSES,
  STATUS_LABELS,
  STATUS_COLORS,
  type YouTubeProjectStatus,
} from "@/lib/vater/youtube-status";
import { YouTubeContextForm } from "./youtube-context-form";
import { YouTubeCreationProgress } from "./youtube-creation-progress";
import { YouTubeFinalPlayer } from "./youtube-final-player";

interface Props {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  project: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onUpdate: (project: any) => void;
}

export function YouTubeProjectDetail({ project, onUpdate }: Props) {
  const status = project.status as YouTubeProjectStatus;
  const statusLabel = STATUS_LABELS[status] || status;
  const statusColor =
    STATUS_COLORS[status] || "text-zinc-400 bg-zinc-400/10";
  const isInFlight = IN_FLIGHT_STATUSES.has(status);
  const isTranscribed = status === "transcribed";
  const isReady = status === "ready";
  const isFailed = status === "failed";
  const isFetching = status === "fetching" || status === "transcribing";
  const isTopicMode = (project.mode || "transcribe") === "topic";

  return (
    <div className="vater-card p-6">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-lg font-semibold text-zinc-200">
            {project.sourceTitle ||
              project.topic ||
              project.sourceUrl ||
              "Untitled Project"}
          </h3>
          {project.sourceChannel && (
            <p className="text-xs text-zinc-500">
              From: {project.sourceChannel}
            </p>
          )}
          {project.sourceUrl && (
            <p className="mt-1 truncate text-xs text-zinc-600">
              {project.sourceUrl}
            </p>
          )}
          {isTopicMode && project.topic && (
            <p className="mt-1 line-clamp-2 text-xs text-zinc-500">
              {project.topic}
            </p>
          )}
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ${statusColor}`}
        >
          {statusLabel}
        </span>
      </div>

      {/* Body — branch on status */}
      {isFetching ? (
        <YouTubeCreationProgress project={project} onUpdate={onUpdate} />
      ) : isTranscribed ? (
        <YouTubeContextForm project={project} onSubmitted={onUpdate} />
      ) : isInFlight ? (
        <YouTubeCreationProgress project={project} onUpdate={onUpdate} />
      ) : isReady ? (
        <YouTubeFinalPlayer project={project} />
      ) : isFailed ? (
        <FailedView project={project} onUpdate={onUpdate} />
      ) : (
        <DraftView project={project} onUpdate={onUpdate} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Draft view — project exists but hasn't started yet (manual URL imported,
// awaiting a server-side fetch). Show a small note + manual poll.
// ---------------------------------------------------------------------------
function DraftView({
  project,
  onUpdate,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  project: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onUpdate: (project: any) => void;
}) {
  const handleRefresh = async () => {
    try {
      const res = await fetch(`/api/vater/youtube/${project.id}/poll`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.project) onUpdate(data.project);
    } catch {
      // ignore
    }
  };

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-6 text-center">
      <p className="text-sm text-zinc-400">
        Project queued. Waiting for the autopilot to start fetching the
        source.
      </p>
      <button
        type="button"
        onClick={handleRefresh}
        className="mt-3 rounded bg-zinc-800 px-3 py-1 text-xs text-zinc-300 hover:bg-zinc-700"
      >
        Refresh
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Failed view — show the error + a refresh button
// ---------------------------------------------------------------------------
function FailedView({
  project,
  onUpdate,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  project: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onUpdate: (project: any) => void;
}) {
  const handleRefresh = async () => {
    try {
      const res = await fetch(`/api/vater/youtube/${project.id}/poll`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.project) onUpdate(data.project);
    } catch {
      // ignore
    }
  };

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4">
        <p className="text-xs font-semibold text-red-400">Pipeline failed</p>
        {project.errorMessage && (
          <p className="mt-1 break-words font-mono text-[10px] text-red-300">
            {project.errorMessage}
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={handleRefresh}
        className="rounded-lg bg-zinc-800 px-4 py-2 text-xs font-semibold text-zinc-300 hover:bg-zinc-700"
      >
        Re-check status
      </button>
    </div>
  );
}
