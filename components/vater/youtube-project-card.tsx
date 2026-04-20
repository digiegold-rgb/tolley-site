"use client";

import {
  STATUS_LABELS,
  STATUS_COLORS,
  type YouTubeProjectStatus,
} from "@/lib/vater/youtube-types";

interface Props {
  project: {
    id: string;
    sourceUrl: string;
    sourceTitle: string | null;
    status: string;
    targetDuration: number;
    createdAt: string;
    progress: number;
  };
  isActive: boolean;
  onClick: () => void;
  onDelete: () => void;
}

export function YouTubeProjectCard({
  project,
  isActive,
  onClick,
  onDelete,
}: Props) {
  const status = project.status as YouTubeProjectStatus;

  return (
    <div
      onClick={onClick}
      className={`vater-card cursor-pointer p-4 transition-all ${
        isActive
          ? "border-sky-400/50 shadow-[0_0_15px_rgba(56,189,248,0.15)]"
          : ""
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-zinc-200">
            {project.sourceTitle || project.sourceUrl}
          </p>
          <div className="mt-1 flex items-center gap-2">
            <span
              className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                STATUS_COLORS[status] || "text-zinc-400 bg-zinc-400/10"
              }`}
            >
              {STATUS_LABELS[status] || status}
            </span>
            <span className="text-[10px] text-zinc-600">
              {project.targetDuration} min
            </span>
          </div>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="text-zinc-600 transition-colors hover:text-red-400"
          title="Delete"
        >
          ✕
        </button>
      </div>

      {/* Progress bar */}
      {project.progress > 0 && project.progress < 100 && (
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-zinc-800">
          <div
            className="h-full rounded-full bg-sky-500/60 transition-all duration-500"
            style={{ width: `${project.progress}%` }}
          />
        </div>
      )}

      <p className="mt-2 text-[10px] text-zinc-600">
        {new Date(project.createdAt).toLocaleDateString()}
      </p>
    </div>
  );
}
