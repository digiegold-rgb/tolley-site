"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type ReactElement } from "react";
import { fetchVaterCapabilities } from "@/components/animate/tier-context";
import { YouTubeFinalPlayer } from "./youtube-final-player";
import { YouTubeShareModal } from "./youtube-share-modal";
import { getStylePreset } from "@/lib/vater/style-presets";
import {
  isFinalMp4Stale,
  finalVideoPlaybackUrl,
  customerStage,
  CUSTOMER_STAGE_LABELS,
  customerStageDetail,
} from "@/lib/vater/youtube-status";
import {
  parseVideoCost,
  formatUsd,
  buildVideoBilling,
  DEFAULT_OPS_RATE_PER_MIN,
} from "@/lib/vater/video-cost";
import { billableComputeUsd } from "@/lib/vater/billing/billable";
import { isPostedToYoutube } from "@/lib/vater/youtube-posted";
import { JELLY_TOKENS } from "@/components/animate/tokens";
import { useTheme } from "@/components/animate/theme-context";

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
  costJson?: unknown;
  finalVideoUrl?: string | null;
  youtubeVideoId?: string | null;
  publishedAt?: string | null;
  settingsJson?: unknown;
}

interface Props {
  projects: LibraryProject[];
  onDelete: (id: string) => void;
  /** Optimistically flip status to `editing` so the card leaves the library. */
  onRecomposeStart?: (id: string) => void;
  /** Same optimistic flip when a Library motion layer is queued. */
  onAnimateLayerStart?: (id: string) => void;
  /** After a successful posted mark/unmark, so parent lists stay in sync. */
  onPostedChange?: (id: string, project: LibraryProject) => void;
}

function formatDuration(seconds: number): string {
  const safe = Math.max(0, Math.round(seconds));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const STAGE_CHIP_CLASS: Record<string, string> = {
  queued: "text-violet-200 bg-violet-500/20 border-violet-400/50",
  in_progress: "text-sky-200 bg-sky-500/20 border-sky-400/50",
  done: "text-emerald-200 bg-emerald-500/20 border-emerald-400/50",
};

function LibraryStageChip({ status }: { status: string }): ReactElement {
  const stage = customerStage(status);
  const label = stage
    ? CUSTOMER_STAGE_LABELS[stage]
    : customerStageDetail(status) ?? status;
  const cls = (stage && STAGE_CHIP_CLASS[stage]) ||
    "text-zinc-200 bg-zinc-500/20 border-zinc-500/40";
  return (
    <span
      data-testid="library-card-stage"
      data-stage={stage ?? status}
      title={customerStageDetail(status) ?? label}
      className={`absolute left-2 top-2 rounded-full border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider backdrop-blur-sm ${cls}`}
    >
      {label}
    </span>
  );
}

/** Ops rate comes from server config (VATER_OPS_RATE_PER_MIN), never a
 *  client constant, so changing the rate needs no deploy. */
function useOpsRate(): number | null {
  const [rate, setRate] = useState<number | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const caps = await fetchVaterCapabilities();
        // /api/vater/latest is owner-only; without this guard every public
        // account 401'd on it on every screen that renders this component.
        if (!caps.latestCosts) return;
        const r = await fetch("/api/vater/latest", { cache: "no-store" });
        if (!r.ok) return;
        const j = (await r.json()) as { billing?: { opsRatePerMinute?: number } };
        const v = j?.billing?.opsRatePerMinute;
        if (!cancelled && typeof v === "number") setRate(v);
      } catch {
        /* fall back to the default rate */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  return rate;
}

export function YouTubeLibrary({
  projects,
  onDelete,
  onRecomposeStart,
  onAnimateLayerStart,
  onPostedChange,
}: Props) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const opsRatePerMinute = useOpsRate();

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
            opsRatePerMinute={opsRatePerMinute}
            key={p.id}
            project={p}
            isActive={p.id === activeId}
            onSelect={() => setActiveId(p.id === activeId ? null : p.id)}
            onDelete={() => {
              if (activeId === p.id) setActiveId(null);
              onDelete(p.id);
            }}
            onPostedChange={onPostedChange}
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
          onAnimateLayerStart={() =>
            onAnimateLayerStart?.(activeProject.id)
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
  onAnimateLayerStart,
}: {
  project: LibraryProject;
  onClose: () => void;
  onRecomposeStart?: () => void;
  onAnimateLayerStart?: () => void;
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
        <div className="flex items-center justify-between gap-3 border-b border-zinc-800 px-5 py-3">
          <div className="flex min-w-0 items-center">
            <h3 className="line-clamp-1 text-sm font-semibold text-zinc-100">
              {title}
            </h3>
            {isPostedToYoutube(project) && (
              <span
                style={{
                  flexShrink: 0,
                  marginLeft: 10,
                  background: JELLY_TOKENS.success,
                  color: JELLY_TOKENS.onGradient,
                  borderRadius: JELLY_TOKENS.radius.xs,
                  padding: "3px 8px",
                  fontSize: 10,
                  fontWeight: 700,
                  fontFamily: JELLY_TOKENS.font,
                }}
              >
                Posted to YouTube
              </span>
            )}
          </div>
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
            onAnimateLayerStart={onAnimateLayerStart}
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
  onPostedChange,
  opsRatePerMinute,
}: {
  project: LibraryProject;
  isActive: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onPostedChange?: (id: string, project: LibraryProject) => void;
  opsRatePerMinute: number | null;
}) {
  const { t } = useTheme();
  const preset = getStylePreset(project.stylePreset ?? "cinematic");
  const title =
    project.sourceTitle ??
    (project.mode === "topic" && project.topic ? project.topic : null) ??
    project.sourceUrl ??
    project.id;

  const scenes = Array.isArray(project.scenesJson) ? project.scenesJson : [];
  const sceneCount = scenes.length;
  const cost = parseVideoCost(project.costJson);
  // Prefer the first scene's image as the card thumbnail so the preview
  // actually represents the video, not a random cinematic preset sample.
  const firstSceneImage =
    scenes.find((s) => typeof s?.imageUrl === "string" && s.imageUrl)?.imageUrl ??
    null;
  const stale = isFinalMp4Stale(project);

  const videoSrc = finalVideoPlaybackUrl(project);
  const downloadHref = `/api/vater/youtube/${project.id}/video?download=1`;
  const [hoverPreview, setHoverPreview] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [posted, setPosted] = useState(() => isPostedToYoutube(project));
  const [postedSaving, setPostedSaving] = useState(false);
  const [postedError, setPostedError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    setPosted(isPostedToYoutube(project));
  }, [project]);

  const togglePosted = async () => {
    const next = !posted;
    setPosted(next);
    setPostedSaving(true);
    setPostedError(null);
    try {
      const res = await fetch(`/api/vater/youtube/${project.id}/posted`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ posted: next }),
      });
      if (!res.ok) {
        const fail = (await res.json().catch(() => null)) as {
          error?: unknown;
        } | null;
        const message =
          typeof fail?.error === "string" && fail.error.trim()
            ? fail.error
            : `Could not update posted status (HTTP ${res.status})`;
        throw new Error(message);
      }
      const data = (await res.json()) as {
        posted?: boolean;
        project?: LibraryProject;
      };
      const confirmed = typeof data.posted === "boolean" ? data.posted : next;
      setPosted(confirmed);
      if (data.project) onPostedChange?.(project.id, data.project);
    } catch (err) {
      setPosted(!next);
      setPostedError(
        err instanceof Error ? err.message : "Could not update posted status",
      );
    } finally {
      setPostedSaving(false);
    }
  };

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

        <LibraryStageChip status={project.status} />

        {/* Stale-final badge — scenes edited after last compose */}
        {stale && (
          <div
            className="absolute right-2 top-2 rounded bg-amber-500/90 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-amber-950 shadow"
            title="Final MP4 is older than your latest scene edits — re-compose to refresh."
          >
            ⚠ stale
          </div>
        )}

        {posted && (
          <div
            title="Posted to YouTube"
            style={{
              position: "absolute",
              top: 8,
              left: 8,
              zIndex: 2,
              maxWidth: "calc(100% - 16px)",
              background: JELLY_TOKENS.success,
              color: JELLY_TOKENS.onGradient,
              borderRadius: JELLY_TOKENS.radius.xs,
              padding: "3px 6px",
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: "0.04em",
              lineHeight: 1.25,
              fontFamily: JELLY_TOKENS.font,
            }}
          >
            Posted to YouTube
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
          {cost && (() => {
            // Billed price = compute (at cost) + render operations.
            // ElevenLabs never bills (customer's own account) — billable.ts.
            const bill = buildVideoBilling(
              billableComputeUsd(cost),
              project.audioDuration,
              opsRatePerMinute ?? DEFAULT_OPS_RATE_PER_MIN,
            );
            return (
              <>
                <span className="text-zinc-700">·</span>
                <span
                  className="font-medium text-emerald-500/90"
                  title={
                    `Compute  ${formatUsd(bill.computeUsd)}\n` +
                    `Render operations  ${formatUsd(bill.opsUsd)}\n` +
                    `Total  ${formatUsd(bill.totalUsd)}`
                  }
                >
                  {formatUsd(bill.totalUsd)}
                  {cost.estimated ? " est" : ""}
                </span>
              </>
            );
          })()}
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

        <button
          type="button"
          disabled={postedSaving}
          aria-pressed={posted}
          aria-label={
            posted
              ? "Unmark as posted to YouTube"
              : "Mark as posted to YouTube"
          }
          title={
            posted
              ? "Unmark as posted to YouTube"
              : "Mark as posted to YouTube — for VidIQ or a manual upload"
          }
          onClick={(e) => {
            e.stopPropagation();
            void togglePosted();
          }}
          style={{
            width: "100%",
            marginTop: 6,
            background: posted ? JELLY_TOKENS.success : "transparent",
            color: posted ? JELLY_TOKENS.onGradient : t.textSecondary,
            border: `1px solid ${posted ? JELLY_TOKENS.success : t.border}`,
            borderRadius: JELLY_TOKENS.radius.xs,
            padding: "5px 8px",
            fontSize: 10,
            fontWeight: 600,
            cursor: postedSaving ? "wait" : "pointer",
            fontFamily: JELLY_TOKENS.font,
            opacity: postedSaving ? 0.7 : 1,
          }}
        >
          {postedSaving
            ? "Saving…"
            : posted
              ? "Unmark posted"
              : "Mark as posted"}
        </button>
        {postedError && (
          <div
            style={{
              marginTop: 4,
              fontSize: 9,
              lineHeight: 1.35,
              color: JELLY_TOKENS.error,
              fontFamily: JELLY_TOKENS.font,
            }}
          >
            {postedError}
          </div>
        )}
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
