"use client";

/**
 * Final MP4 player + metadata for completed VATER YouTube projects.
 *
 * Source-of-truth fields all live on `YouTubeProject` after the poll route
 * copies them out of the autopilot job result.
 *
 * Layout (rebuilt 2026-04-23 — prior layout was called "horrible"):
 *   - Cinematic 16:9 video frame with neon glow, poster image, native
 *     <video controls> (native gives us keyboard + PiP + AirPlay for free;
 *     styled container makes it feel premium without building a custom
 *     player).
 *   - Primary action row: Share, Edit, Download, Copy link — all neon-chip
 *     CTAs, evenly sized.
 *   - Compact metadata row: chips instead of 4 dense cards.
 *   - Stale banner / verification warnings pinned below primary actions
 *     so they're visible but not screaming.
 *   - Thumbnail tucked into a small aside with generate/download.
 *   - Audio-only <audio> preview removed — video already has audio.
 */

import { useRef, useState } from "react";
import { useToast } from "@/components/ui/Toast";
import { VideoSpeedChips } from "@/components/ui/VideoSpeedChips";
import { isFinalMp4Stale } from "@/lib/vater/youtube-status";
import { YouTubeShareModal } from "./youtube-share-modal";

interface VerificationReport {
  ok?: boolean;
  fabrications?: string[];
  summary?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  coverage?: any[];
}

interface ProjectShape {
  id: string;
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
  status?: string;
  editedAt?: string | null;
}

interface Props {
  project: ProjectShape;
  /**
   * Called when the user kicks a re-compose from the stale-final banner so
   * the parent can optimistically flip status to `editing` (hides the
   * project from the Library until the DGX poll route refreshes it).
   */
  onRecomposeStart?: () => void;
}

export function YouTubeFinalPlayer({ project, onRecomposeStart }: Props) {
  const { toast } = useToast();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [showFabrications, setShowFabrications] = useState(false);
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(
    project.thumbnailUrl ?? null,
  );
  const [generatingThumb, setGeneratingThumb] = useState(false);
  const [recomposing, setRecomposing] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const stale = isFinalMp4Stale({
    status: project.status ?? "ready",
    editedAt: project.editedAt ?? null,
    completedAt: project.completedAt ?? null,
  });

  const handleRecompose = async () => {
    setRecomposing(true);
    try {
      const res = await fetch(
        `/api/vater/youtube/${project.id}/compose`,
        { method: "POST" },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || `HTTP ${res.status}`);
      }
      toast({
        title: "Re-compose started",
        description: "DGX is baking the animated scenes into a new final.mp4.",
        variant: "success",
      });
      onRecomposeStart?.();
    } catch (err) {
      toast({
        title: "Re-compose failed",
        description: err instanceof Error ? err.message : "unknown",
        variant: "error",
      });
    } finally {
      setRecomposing(false);
    }
  };

  const handleGenerateThumbnail = async () => {
    setGeneratingThumb(true);
    try {
      const res = await fetch(
        `/api/vater/youtube/${project.id}/thumbnail`,
        { method: "POST" },
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || data.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setThumbnailUrl(data.project?.thumbnailUrl ?? null);
      toast({
        title: "Thumbnail generated",
        description: "1280×720 thumbnail is ready.",
        variant: "success",
      });
    } catch (err) {
      toast({
        title: "Thumbnail failed",
        description: err instanceof Error ? err.message : "unknown",
        variant: "error",
      });
    } finally {
      setGeneratingThumb(false);
    }
  };

  const videoSrc = `/api/vater/youtube/${project.id}/video`;
  const downloadHref = `${videoSrc}?download=1`;

  const sceneCount = Array.isArray(project.scenesJson)
    ? project.scenesJson.length
    : 0;
  const scriptWordCount = project.script
    ? project.script.split(/\s+/).filter(Boolean).length
    : 0;

  const verificationReport =
    project.verificationReport &&
    typeof project.verificationReport === "object"
      ? (project.verificationReport as VerificationReport)
      : null;
  const fabrications = verificationReport?.fabrications ?? [];
  const hasWarnings = fabrications.length > 0;

  const handleCopyLink = async () => {
    const shareUrl = `${window.location.origin}/vater/youtube/${project.id}`;
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast({
        title: "Link copied",
        description: shareUrl,
        variant: "success",
      });
    } catch {
      toast({
        title: "Could not copy link",
        description: shareUrl,
        variant: "warning",
      });
    }
  };

  const title =
    project.sourceTitle ?? project.topic ?? project.sourceUrl ?? project.id;
  const verificationTone: "success" | "warning" | "muted" = project.verifiedScript
    ? hasWarnings
      ? "warning"
      : "success"
    : "muted";
  const verificationLabel = project.verifiedScript
    ? hasWarnings
      ? `⚠ ${fabrications.length} warning${fabrications.length === 1 ? "" : "s"}`
      : "✓ verified"
    : "not verified";

  return (
    <div className="space-y-5">
      {/* ── Cinematic video frame — neon sky glow, poster thumbnail, native
            <video> controls (free keyboard / PiP / AirPlay / captions). */}
      <div className="group relative overflow-hidden rounded-2xl border border-sky-500/25 bg-black shadow-[0_0_32px_rgba(56,189,248,0.12)] ring-1 ring-sky-400/10 transition-shadow hover:shadow-[0_0_48px_rgba(56,189,248,0.22)]">
        <div className="aspect-video w-full">
          <video
            ref={videoRef}
            controls
            controlsList="nodownload"
            preload="metadata"
            poster={thumbnailUrl ?? undefined}
            src={videoSrc}
            className="h-full w-full bg-black"
          >
            Your browser does not support HTML5 video.
          </video>
        </div>
        {/* Corner badge — cinematic polish */}
        <div className="pointer-events-none absolute left-3 top-3 rounded-full bg-black/70 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-300 backdrop-blur">
          Final · {project.audioDuration ? formatDuration(project.audioDuration) : "—"}
        </div>
      </div>

      {/* Playback speed — review long videos at 2x/4x without using the
          native context menu. */}
      <VideoSpeedChips videoRef={videoRef} large className="justify-end" />

      {/* ── Stale-final banner (pinned below video so it's visible but not in the way) */}
      {stale && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-amber-300">
              Scenes changed since last compose
            </p>
            <p className="mt-0.5 text-[11px] text-amber-200/80">
              The final MP4 above was rendered before your latest edits —
              re-compose to bake them in.
            </p>
          </div>
          <button
            type="button"
            onClick={handleRecompose}
            disabled={recomposing}
            className="shrink-0 rounded-lg bg-amber-500/20 px-4 py-2 text-xs font-semibold text-amber-200 transition-colors hover:bg-amber-500/30 disabled:opacity-50"
          >
            {recomposing ? "Kicking DGX…" : "Re-compose now"}
          </button>
        </div>
      )}

      {/* ── Primary action grid — four neon chips, evenly sized, share leads */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <button
          type="button"
          onClick={() => setShareOpen(true)}
          className="flex items-center justify-center gap-2 rounded-lg border border-fuchsia-400/50 bg-gradient-to-br from-fuchsia-500/20 to-fuchsia-500/5 px-4 py-2.5 text-sm font-semibold text-fuchsia-200 shadow-[0_0_10px_rgba(217,70,239,0.20)] transition-all hover:border-fuchsia-300 hover:shadow-[0_0_18px_rgba(217,70,239,0.40)]"
        >
          <span>⇪</span> Share
        </button>
        <a
          href={`/vater/youtube/${project.id}/edit`}
          className="flex items-center justify-center gap-2 rounded-lg border border-sky-400/50 bg-gradient-to-br from-sky-500/20 to-sky-500/5 px-4 py-2.5 text-sm font-semibold text-sky-200 shadow-[0_0_10px_rgba(56,189,248,0.20)] transition-all hover:border-sky-300 hover:shadow-[0_0_18px_rgba(56,189,248,0.40)]"
        >
          <span>✏</span> Edit scenes
        </a>
        <a
          href={downloadHref}
          download={`${project.sourceTitle || project.id}.mp4`}
          className="flex items-center justify-center gap-2 rounded-lg border border-emerald-400/50 bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 px-4 py-2.5 text-sm font-semibold text-emerald-200 shadow-[0_0_10px_rgba(52,211,153,0.20)] transition-all hover:border-emerald-300 hover:shadow-[0_0_18px_rgba(52,211,153,0.40)]"
        >
          <span>↓</span> Download MP4
        </a>
        <button
          type="button"
          onClick={handleCopyLink}
          className="flex items-center justify-center gap-2 rounded-lg border border-zinc-600 bg-zinc-900/60 px-4 py-2.5 text-sm font-semibold text-zinc-200 transition-all hover:border-zinc-400 hover:bg-zinc-800"
        >
          <span>🔗</span> Copy link
        </button>
      </div>

      {/* ── Metadata chip row — compact single-line summary */}
      <div className="flex flex-wrap items-center gap-2 text-[11px]">
        <MetaChip label="Duration" value={project.audioDuration ? formatDuration(project.audioDuration) : "—"} />
        <MetaChip label="Scenes" value={sceneCount.toString()} />
        <MetaChip label="Script" value={`${scriptWordCount.toLocaleString()} words`} />
        <MetaChip label="Verify" value={verificationLabel} tone={verificationTone} />
        <span className="text-zinc-400">
          Created{" "}
          {new Date(project.completedAt || project.createdAt).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </span>
        {project.sourceUrl && (
          <a
            href={project.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="text-zinc-400 underline-offset-2 hover:text-sky-300 hover:underline"
          >
            view source ↗
          </a>
        )}
      </div>

      {/* ── Thumbnail aside + regenerate. Compact, tucked at the bottom. */}
      {project.autopilotJobId && (
        <div className="flex items-start gap-3 rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
          {thumbnailUrl ? (
            <a
              href={thumbnailUrl}
              download={`${project.sourceTitle || project.id}-thumbnail.jpg`}
              title="Download thumbnail"
              className="relative block w-40 shrink-0 overflow-hidden rounded-md border border-zinc-700 transition-all hover:border-sky-400/60"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={thumbnailUrl}
                alt="YouTube thumbnail"
                className="aspect-video w-full object-cover"
              />
              <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/0 text-xs font-semibold text-white opacity-0 transition-all hover:bg-black/50 hover:opacity-100">
                Download ↓
              </span>
            </a>
          ) : (
            <div className="flex aspect-video w-40 shrink-0 items-center justify-center rounded-md border border-dashed border-zinc-700 bg-zinc-900/60 text-xs text-zinc-400">
              No thumbnail
            </div>
          )}
          <div className="flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
              Thumbnail
            </p>
            <p className="mt-1 text-[11px] text-zinc-300">
              1280×720 JPEG used as the Library card cover + the {"<video>"} poster.
              Regenerate any time to get a fresh AI-picked frame.
            </p>
            <button
              type="button"
              onClick={handleGenerateThumbnail}
              disabled={generatingThumb}
              className="mt-2 rounded-md border border-violet-400/40 bg-violet-500/15 px-3 py-1.5 text-[11px] font-semibold text-violet-300 hover:bg-violet-500/25 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {generatingThumb ? "Generating…" : thumbnailUrl ? "Regenerate" : "Generate"}
            </button>
          </div>
        </div>
      )}

      {/* ── Fabrications warning — collapsible */}
      {hasWarnings && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
          <button
            type="button"
            onClick={() => setShowFabrications(!showFabrications)}
            className="flex w-full items-center justify-between text-left"
          >
            <span className="text-xs font-semibold text-amber-300">
              ⚠ Verification flagged {fabrications.length} potential
              fabrication{fabrications.length === 1 ? "" : "s"}
            </span>
            <span className="text-[10px] text-amber-400">
              {showFabrications ? "hide" : "show"}
            </span>
          </button>
          {showFabrications && (
            <ul className="mt-2 list-disc space-y-1 pl-5 text-[11px] text-amber-100">
              {fabrications.map((f, i) => (
                <li key={i}>{f}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Share modal */}
      {shareOpen && (
        <YouTubeShareModal
          projectId={project.id}
          projectTitle={title}
          onClose={() => setShareOpen(false)}
        />
      )}
    </div>
  );
}

/** Compact metadata chip — replaces the old 4-column card grid. */
function MetaChip({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "success" | "warning" | "muted";
}) {
  const toneClass =
    tone === "success"
      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
      : tone === "warning"
        ? "border-amber-500/40 bg-amber-500/10 text-amber-300"
        : tone === "muted"
          ? "border-zinc-700 bg-zinc-900/40 text-zinc-400"
          : "border-zinc-700 bg-zinc-900/60 text-zinc-200";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 ${toneClass}`}
    >
      <span className="text-[9px] font-semibold uppercase tracking-wider opacity-70">
        {label}
      </span>
      <span className="text-[11px] font-semibold">{value}</span>
    </span>
  );
}

function formatDuration(seconds: number): string {
  const safe = Math.max(0, Math.round(seconds));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}
