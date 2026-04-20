"use client";

/**
 * Horizontal filmstrip of scenes. Each card shows a thumbnail (streamed via
 * /api/vater/youtube/[id]/scene/[idx]?v=N), the beat text, and duration.
 *
 * Phase 1 is read-only: click selects a scene so the drawer can edit it.
 * Phase 2 will add drag-drop reorder, add-between, delete.
 */
import { useMemo } from "react";
import type { SceneSpec } from "@/lib/vater/video-spec";

type Props = {
  projectId: string;
  scenes: SceneSpec[];
  activeIdx: number | null;
  onSelect: (idx: number) => void;
};

export function SceneTimeline({
  projectId,
  scenes,
  activeIdx,
  onSelect,
}: Props) {
  const total = useMemo(
    () =>
      scenes.reduce((acc, s) => Math.max(acc, s.endS), 0),
    [scenes],
  );

  if (scenes.length === 0) {
    return (
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-6 text-center text-xs text-zinc-500">
        No scenes yet. Generate a project first.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between px-1 text-[10px] uppercase tracking-wider text-zinc-500">
        <span>{scenes.length} scenes</span>
        <span>{formatDuration(total)}</span>
      </div>
      <div className="scrollbar-thin flex gap-2 overflow-x-auto pb-2">
        {scenes.map((scene) => (
          <SceneCard
            key={scene.idx}
            projectId={projectId}
            scene={scene}
            active={activeIdx === scene.idx}
            onClick={() => onSelect(scene.idx)}
          />
        ))}
      </div>
    </div>
  );
}

function SceneCard({
  projectId,
  scene,
  active,
  onClick,
}: {
  projectId: string;
  scene: SceneSpec;
  active: boolean;
  onClick: () => void;
}) {
  const duration = Math.max(0, scene.endS - scene.startS);
  const thumbUrl = `/api/vater/youtube/${projectId}/scene/${scene.idx}?v=${
    scene.version ?? 0
  }`;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative shrink-0 overflow-hidden rounded-lg border text-left transition-all ${
        active
          ? "border-emerald-400 ring-2 ring-emerald-400/30"
          : "border-zinc-800 hover:border-zinc-600"
      }`}
      style={{ width: 200 }}
    >
      <div className="relative aspect-video w-full bg-zinc-900">
        {scene.mediaType === "video" ? (
          <video
            src={thumbUrl}
            className="h-full w-full object-cover"
            muted
            playsInline
            preload="metadata"
            onMouseEnter={(e) => (e.target as HTMLVideoElement).play()}
            onMouseLeave={(e) => {
              const v = e.target as HTMLVideoElement;
              v.pause();
              v.currentTime = 0;
            }}
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumbUrl}
            alt={scene.beatText || `Scene ${scene.idx + 1}`}
            className="h-full w-full object-cover"
            loading="lazy"
            decoding="async"
          />
        )}
        <div className="absolute bottom-1 right-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-semibold text-white">
          {formatDuration(duration)}
        </div>
        <div className="absolute top-1 left-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-semibold text-white">
          #{scene.idx + 1}
        </div>
        {scene.version && scene.version > 0 ? (
          <div className="absolute top-1 right-1 rounded bg-emerald-500/90 px-1.5 py-0.5 text-[10px] font-semibold text-black">
            v{scene.version}
          </div>
        ) : null}
        <OverlayBadge scene={scene} />
      </div>
      <div className="bg-zinc-900/60 p-2">
        <p className="line-clamp-2 text-[11px] text-zinc-300">
          {scene.beatText || "(no beat text)"}
        </p>
      </div>
    </button>
  );
}

/**
 * Smart Overlay badge — shows when the classifier or user manually tagged
 * a scene as chart / map / header. Renders as a colored pill at the
 * bottom-left of the thumbnail. The actual overlay component renders in
 * the Player + final video; this badge just signals "this scene is
 * special — click to review."
 */
function OverlayBadge({ scene }: { scene: SceneSpec }) {
  if (scene.isHeader) {
    return (
      <div className="absolute bottom-1 left-1 rounded bg-amber-500/90 px-1.5 py-0.5 text-[10px] font-semibold text-amber-950">
        🔤 Header
      </div>
    );
  }
  if (scene.isChart) {
    return (
      <div className="absolute bottom-1 left-1 rounded bg-sky-500/90 px-1.5 py-0.5 text-[10px] font-semibold text-sky-950">
        📊 Chart
      </div>
    );
  }
  if (scene.isMap) {
    return (
      <div className="absolute bottom-1 left-1 rounded bg-emerald-500/90 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-950">
        🌍 Map
      </div>
    );
  }
  return null;
}

function formatDuration(seconds: number): string {
  const safe = Math.max(0, Math.round(seconds));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}
