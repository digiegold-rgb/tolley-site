"use client";

import Image from "next/image";
import {
  STATUS_LABELS,
  STATUS_COLORS,
  type YouTubeProjectStatus,
} from "@/lib/vater/youtube-types";
import { getStylePreset } from "@/lib/vater/style-presets";

interface Props {
  project: {
    id: string;
    sourceUrl: string;
    sourceTitle: string | null;
    status: string;
    targetDuration: number;
    createdAt: string;
    progress: number;
    stylePreset: string | null;
    mode: string | null;
    topic: string | null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    scenesJson?: any;
    thumbnailUrl?: string | null;
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
  const preset = getStylePreset(project.stylePreset ?? "cinematic");
  const title =
    project.sourceTitle ||
    (project.mode === "topic" && project.topic ? project.topic : null) ||
    project.sourceUrl;

  // Prefer the first generated scene as the card preview so users see actual
  // video content rather than the random cinematic preset sample.
  const scenes = Array.isArray(project.scenesJson) ? project.scenesJson : [];
  const firstSceneImage =
    scenes.find(
      (s: { imageUrl?: unknown }) =>
        typeof s?.imageUrl === "string" && s.imageUrl,
    )?.imageUrl ?? null;
  const previewSrc =
    firstSceneImage ?? project.thumbnailUrl ?? preset?.sampleImageUrl ?? null;
  const previewIsScene = Boolean(firstSceneImage);

  return (
    <div
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      role="button"
      tabIndex={0}
      aria-label={`Open project: ${title}`}
      className={`vater-card cursor-pointer overflow-hidden transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 ${
        isActive
          ? "border-sky-400/50 shadow-[0_0_15px_rgba(56,189,248,0.15)]"
          : ""
      }`}
    >
      {/* Style preview banner */}
      <div className="relative h-20 w-full overflow-hidden bg-zinc-900">
        {previewSrc && (
          <Image
            src={previewSrc}
            alt={previewIsScene ? title || "first scene" : preset?.name || "preview"}
            fill
            className={`object-cover ${previewIsScene ? "" : "opacity-70"}`}
            sizes="320px"
            unoptimized={previewIsScene}
          />
        )}
        {/* gradient fade to card body */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-zinc-900/90" />
        {/* style badge */}
        <div className="absolute bottom-1.5 left-2 flex items-center gap-1">
          <span className="text-sm">{preset?.emoji ?? "🎬"}</span>
          <span className="rounded bg-black/50 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-white/80 backdrop-blur-sm">
            {preset?.name ?? "Cinematic"}
          </span>
        </div>
        {/* delete button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="absolute right-2 top-2 rounded bg-black/40 px-1.5 py-0.5 text-[11px] text-zinc-400 backdrop-blur-sm transition-colors hover:text-red-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
          title="Delete project"
          aria-label={`Delete project: ${title}`}
        >
          ✕
        </button>
      </div>

      {/* Card body */}
      <div className="p-3">
        <p className="line-clamp-2 text-xs font-medium leading-snug text-zinc-200">
          {title}
        </p>

        <div className="mt-1.5 flex items-center gap-2">
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

        {/* Progress bar */}
        {project.progress > 0 && project.progress < 100 && (
          <div className="mt-2 h-1 overflow-hidden rounded-full bg-zinc-800">
            <div
              className="h-full rounded-full bg-sky-500/60 transition-all duration-500"
              style={{ width: `${project.progress}%` }}
            />
          </div>
        )}

        <p className="mt-1.5 text-[10px] text-zinc-600">
          {new Date(project.createdAt).toLocaleDateString()}
        </p>
      </div>
    </div>
  );
}
