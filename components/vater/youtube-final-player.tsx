"use client";

/**
 * Final MP4 player + metadata for completed VATER YouTube projects.
 *
 * Source-of-truth fields all live on `YouTubeProject` after the poll route
 * copies them out of the autopilot job result.
 */

import { useState } from "react";
import { useToast } from "@/components/ui/Toast";

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
  audioDuration: number | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  scenesJson: any;
  script: string | null;
  verifiedScript: boolean;
  verificationReport: unknown;
  completedAt: string | null;
  createdAt: string;
}

interface Props {
  project: ProjectShape;
}

export function YouTubeFinalPlayer({ project }: Props) {
  const { toast } = useToast();
  const [showFabrications, setShowFabrications] = useState(false);

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

  return (
    <div className="space-y-4">
      {/* Video */}
      <div className="relative w-full overflow-hidden rounded-lg border border-zinc-800 bg-black">
        <div className="aspect-video">
          <video
            controls
            preload="metadata"
            src={videoSrc}
            className="h-full w-full"
          >
            Your browser does not support HTML5 video.
          </video>
        </div>
      </div>

      {/* Action bar */}
      <div className="flex flex-wrap items-center gap-3">
        <a
          href={downloadHref}
          download={`${project.sourceTitle || project.id}.mp4`}
          className="rounded-lg bg-emerald-500/20 px-4 py-2 text-xs font-semibold text-emerald-400 transition-colors hover:bg-emerald-500/30"
        >
          Download MP4
        </a>
        <button
          type="button"
          onClick={handleCopyLink}
          className="rounded-lg bg-zinc-800 px-4 py-2 text-xs font-semibold text-zinc-300 transition-colors hover:bg-zinc-700"
        >
          Copy share link
        </button>
        {project.sourceUrl && (
          <a
            href={project.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="text-[10px] text-zinc-500 underline-offset-2 hover:underline"
          >
            view source
          </a>
        )}
      </div>

      {/* Metadata cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MetaCard
          label="Audio"
          value={
            project.audioDuration
              ? formatDuration(project.audioDuration)
              : "—"
          }
        />
        <MetaCard label="Scenes" value={sceneCount.toString()} />
        <MetaCard
          label="Script"
          value={`${scriptWordCount.toLocaleString()} words`}
        />
        <MetaCard
          label="Verification"
          value={
            project.verifiedScript
              ? hasWarnings
                ? "warnings"
                : "verified"
              : "unverified"
          }
          tone={
            project.verifiedScript
              ? hasWarnings
                ? "warning"
                : "success"
              : "muted"
          }
        />
      </div>

      {/* Fabrications warning */}
      {hasWarnings && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
          <button
            type="button"
            onClick={() => setShowFabrications(!showFabrications)}
            className="flex w-full items-center justify-between text-left"
          >
            <span className="text-xs font-semibold text-amber-400">
              Verification flagged {fabrications.length} potential
              fabrication{fabrications.length === 1 ? "" : "s"}
            </span>
            <span className="text-[10px] text-amber-500">
              {showFabrications ? "hide" : "show"}
            </span>
          </button>
          {showFabrications && (
            <ul className="mt-2 list-disc space-y-1 pl-5 text-[11px] text-amber-200">
              {fabrications.map((f, i) => (
                <li key={i}>{f}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Created date */}
      <p className="text-[10px] text-zinc-600">
        Created{" "}
        {new Date(project.completedAt || project.createdAt).toLocaleString()}
      </p>
    </div>
  );
}

function MetaCard({
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
      ? "text-emerald-400"
      : tone === "warning"
        ? "text-amber-400"
        : tone === "muted"
          ? "text-zinc-500"
          : "text-zinc-200";
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
      <p className="text-[10px] uppercase tracking-wider text-zinc-600">
        {label}
      </p>
      <p className={`mt-1 text-sm font-semibold ${toneClass}`}>{value}</p>
    </div>
  );
}

function formatDuration(seconds: number): string {
  const safe = Math.max(0, Math.round(seconds));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}
