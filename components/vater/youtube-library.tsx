"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { YouTubeFinalPlayer } from "./youtube-final-player";
import { YouTubeShareModal } from "./youtube-share-modal";
import { getStylePreset } from "@/lib/vater/style-presets";
import { isFinalMp4Stale } from "@/lib/vater/youtube-status";

interface LibraryProject {
  id: string;
  mode: string | null;
  sourceTitle: string | null;
  sourceUrl: string | null;
  topic: string | null;
  audioDuration: number | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  scenesJson: any;
  script: string | null;
  verifiedScript: boolean;
  verificationReport: unknown;
  completedAt: string | null;
  createdAt: string;
  thumbnailUrl: string | null;
  stylePreset: string | null;
  autopilotJobId: string | null;
  targetDuration: number;
  status: string;
  editedAt: string | null;
}

interface Props {
  projects: LibraryProject[];
  onDelete: (id: string) => void;
  /** Optimistically flip status to `editing` so the card leaves the library. */
  onRecomposeStart?: (id: string) => void;
}

function formatDuration(seconds: number): string {
  const safe = Math.max(0, Math.round(seconds));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function YouTubeLibrary({ projects, onDelete, onRecomposeStart }: Props) {
  const [activeId, setActiveId] = useState<string | null>(null);

  const activeProject = projects.find((p) => p.id === activeId) ?? null;

  if (projects.length === 0) {
    return (
      <div className="vater-card flex min-h-[300px] flex-col items-center justify-center gap-3 p-10 text-center">
        <span className="text-4xl">🎬</span>
        <p className="text-sm text-zinc-400">No completed videos yet.</p>
        <p className="text-xs text-zinc-600">
          Finished videos appear here automatically once the pipeline completes.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 md:grid-cols-5 xl:grid-cols-7 2xl:grid-cols-8">
        {projects.map((p) => (
          <LibraryCard
            key={p.id}
            project={p}
            isActive={p.id === activeId}
            onSelect={() => setActiveId(p.id === activeId ? null : p.id)}
            onDelete={() => {
              if (activeId === p.id) setActiveId(null);
              onDelete(p.id);
            }}
          />
        ))}
      </div>

      {/* Lightbox player — opens as a centered modal so the video gets
          full natural 16:9 on a dark backdrop rather than fighting the
          card-grid column width. Dismissed by backdrop click, ESC, or
          the close button. Body scroll is locked while open. */}
      {activeProject && (
        <PlayerLightbox
          project={activeProject}
          onClose={() => setActiveId(null)}
          onRecomposeStart={() =>
            onRecomposeStart?.(activeProject.id)
          }
        />
      )}
    </div>
  );
}

function PlayerLightbox({
  project,
  onClose,
  onRecomposeStart,
}: {
  project: LibraryProject;
  onClose: () => void;
  onRecomposeStart?: () => void;
}) {
  // ESC-to-close + body-scroll lock while the lightbox is mounted.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const title =
    project.sourceTitle ??
    (project.mode === "topic" && project.topic ? project.topic : null) ??
    project.sourceUrl ??
    project.id;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Playing ${title}`}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-5xl overflow-hidden rounded-2xl border border-sky-500/30 bg-zinc-950 shadow-[0_0_60px_rgba(56,189,248,0.25)]"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-3">
          <h3 className="line-clamp-1 text-sm font-semibold text-zinc-100">
            {title}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close player"
            className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100"
          >
            ✕
          </button>
        </div>

        {/* Scrollable body — video first, natural 16:9, then metadata + share
            all within the lightbox so users don't lose context. */}
        <div className="max-h-[85vh] overflow-y-auto px-5 py-4">
          <YouTubeFinalPlayer
            project={project}
            onRecomposeStart={onRecomposeStart}
          />
        </div>
      </div>
    </div>
  );
}

function LibraryCard({
  project,
  isActive,
  onSelect,
  onDelete,
}: {
  project: LibraryProject;
  isActive: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  const preset = getStylePreset(project.stylePreset ?? "cinematic");
  const title =
    project.sourceTitle ??
    (project.mode === "topic" && project.topic ? project.topic : null) ??
    project.sourceUrl ??
    project.id;

  const scenes = Array.isArray(project.scenesJson) ? project.scenesJson : [];
  const sceneCount = scenes.length;
  // Prefer the first scene's image as the card thumbnail so the preview
  // actually represents the video, not a random cinematic preset sample.
  const firstSceneImage =
    scenes.find((s) => typeof s?.imageUrl === "string" && s.imageUrl)?.imageUrl ??
    null;
  const stale = isFinalMp4Stale(project);

  const videoSrc = `/api/vater/youtube/${project.id}/video`;
  const downloadHref = `${videoSrc}?download=1`;
  const [hoverPreview, setHoverPreview] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Play silent video loop while hovering the thumbnail — gives the user an
  // instant preview of the finished product without clicking. Reset on leave
  // so the poster shows again and we don't keep streaming off-screen.
  const startHoverPreview = () => {
    setHoverPreview(true);
    requestAnimationFrame(() => {
      videoRef.current?.play().catch(() => {
        /* autoplay policy may block — poster still renders */
      });
    });
  };
  const endHoverPreview = () => {
    setHoverPreview(false);
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
  };

  const dateStr = new Date(
    project.completedAt ?? project.createdAt,
  ).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div
      className={`vater-card group overflow-hidden transition-all ${
        isActive
          ? "border-sky-400/50 shadow-[0_0_18px_rgba(56,189,248,0.15)]"
          : "hover:border-zinc-700"
      }`}
    >
      {/* Thumbnail / preview banner — acts as a clickable "Play" affordance
          for mouse users. Keyboard users use the dedicated Play button below
          (role=button + onKeyDown here just makes the thumbnail focusable
          too so the expected card-level interaction is reachable either way). */}
      <div
        onClick={onSelect}
        onMouseEnter={startHoverPreview}
        onMouseLeave={endHoverPreview}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onSelect();
          }
        }}
        role="button"
        tabIndex={0}
        aria-label={isActive ? `Close player for ${title}` : `Play ${title}`}
        className="relative aspect-square w-full cursor-pointer overflow-hidden bg-zinc-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
      >
        {hoverPreview ? (
          <video
            ref={videoRef}
            src={videoSrc}
            muted
            loop
            playsInline
            preload="metadata"
            className="h-full w-full object-cover"
          />
        ) : firstSceneImage ? (
          <Image
            src={firstSceneImage}
            alt={title ?? "first scene"}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 33vw"
            unoptimized
          />
        ) : project.thumbnailUrl ? (
          <Image
            src={project.thumbnailUrl}
            alt={title ?? "thumbnail"}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 33vw"
          />
        ) : preset?.sampleImageUrl ? (
          <Image
            src={preset.sampleImageUrl}
            alt={preset.name}
            fill
            className="object-cover opacity-60 transition-transform duration-300 group-hover:scale-105"
            sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 33vw"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-4xl opacity-40">
            🎬
          </div>
        )}

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/80 via-transparent to-transparent" />

        {/* Duration pill */}
        {project.audioDuration && (
          <div className="absolute bottom-2 right-2 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-white backdrop-blur-sm">
            {formatDuration(project.audioDuration)}
          </div>
        )}

        {/* Style badge */}
        <div className="absolute bottom-2 left-2 flex items-center gap-1">
          <span className="text-sm">{preset?.emoji ?? "🎬"}</span>
          <span className="rounded bg-black/60 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-white/80 backdrop-blur-sm">
            {preset?.name ?? "Cinematic"}
          </span>
        </div>

        {/* Stale-final badge — scenes edited after last compose */}
        {stale && (
          <div
            className="absolute right-2 top-2 rounded bg-amber-500/90 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-amber-950 shadow"
            title="Final MP4 is older than your latest scene edits — re-compose to refresh."
          >
            ⚠ stale
          </div>
        )}

        {/* Play overlay on hover */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-black/60 backdrop-blur-sm">
            <span className="ml-1 text-xl text-white">▶</span>
          </div>
        </div>
      </div>

      {/* Card body */}
      <div className="p-2">
        <p className="line-clamp-2 text-[11px] font-medium leading-snug text-zinc-200">
          {title}
        </p>

        <div className="mt-1 flex flex-wrap items-center gap-1 text-[9px] text-zinc-500">
          {sceneCount > 0 && <span>{sceneCount} scenes</span>}
          {sceneCount > 0 && project.audioDuration && (
            <span className="text-zinc-700">·</span>
          )}
          <span>{dateStr}</span>
        </div>

        {/* Actions */}
        <div className="mt-2 flex items-center gap-1">
          <button
            type="button"
            onClick={onSelect}
            className="flex-1 rounded bg-sky-500/15 px-1.5 py-1 text-center text-[10px] font-semibold text-sky-300 transition-colors hover:bg-sky-500/25"
          >
            {isActive ? "Close" : "Play"}
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setShareOpen(true);
            }}
            title="Share to YouTube, TikTok, Instagram, and more"
            aria-label="Share"
            className="rounded bg-fuchsia-500/15 px-1.5 py-1 text-[10px] font-semibold text-fuchsia-300 transition-colors hover:bg-fuchsia-500/25"
          >
            ⇪
          </button>
          <a
            href={downloadHref}
            download={`${project.sourceTitle ?? project.id}.mp4`}
            onClick={(e) => e.stopPropagation()}
            title="Download MP4"
            aria-label="Download MP4"
            className="rounded bg-emerald-500/15 px-1.5 py-1 text-[10px] font-semibold text-emerald-400 transition-colors hover:bg-emerald-500/25"
          >
            ↓
          </a>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            title="Delete video"
            aria-label={`Delete video: ${title}`}
            className="rounded bg-zinc-800 px-1.5 py-1 text-[10px] text-zinc-500 transition-colors hover:bg-red-500/10 hover:text-red-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
          >
            ✕
          </button>
        </div>
      </div>
      {shareOpen && (
        <YouTubeShareModal
          projectId={project.id}
          projectTitle={title ?? project.id}
          onClose={() => setShareOpen(false)}
        />
      )}
    </div>
  );
}
