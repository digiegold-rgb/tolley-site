"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, MouseEvent as ReactMouseEvent } from "react";

import type { AudioClip, Project, VideoClip } from "@/lib/video-editor/types";

const DEFAULT_PIXELS_PER_SECOND = 60;
const TRACK_HEIGHT = 56;
const TRACK_GAP = 4;
const RULER_HEIGHT = 28;

export type TimelineSelection =
  | { kind: "video"; trackId: string; clipId: string }
  | { kind: "audio"; trackId: string; clipId: string }
  | { kind: "overlay"; overlayId: string }
  | null;

type TimelineProps = {
  project: Project;
  currentTimeS: number;
  selection: TimelineSelection;
  onSelect: (next: TimelineSelection) => void;
  onSeek: (timeS: number) => void;
  onMoveClip?: (clipId: string, deltaS: number) => void;
  onTrimClip?: (clipId: string, side: "in" | "out", deltaS: number) => void;
};

export function Timeline({
  project,
  currentTimeS,
  selection,
  onSelect,
  onSeek,
  onMoveClip,
  onTrimClip,
}: TimelineProps) {
  const [pxPerSec, setPxPerSec] = useState(DEFAULT_PIXELS_PER_SECOND);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const totalSeconds = Math.max(project.durationS + 2, 10);
  const totalWidth = Math.ceil(totalSeconds * pxPerSec);

  const ticks = useMemo(() => buildTicks(totalSeconds, pxPerSec), [totalSeconds, pxPerSec]);

  function handleRulerClick(e: ReactMouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left + (scrollRef.current?.scrollLeft ?? 0);
    const t = Math.max(0, x / pxPerSec);
    onSeek(t);
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-slate-800 px-2 py-1">
        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
          Timeline · {project.durationS.toFixed(1)}s
        </p>
        <div className="flex items-center gap-2 text-[11px] text-slate-500">
          <span>Zoom</span>
          <input
            type="range"
            min={20}
            max={200}
            step={10}
            value={pxPerSec}
            onChange={(e) => setPxPerSec(Number(e.target.value))}
            className="accent-purple-400"
          />
          <span className="w-10 text-right text-slate-400">{pxPerSec}px/s</span>
        </div>
      </div>

      <div ref={scrollRef} className="relative flex-1 overflow-x-auto overflow-y-hidden">
        <div style={{ width: totalWidth, position: "relative" }}>
          {/* Ruler */}
          <div
            onClick={handleRulerClick}
            className="sticky top-0 z-20 cursor-col-resize border-b border-slate-800 bg-slate-900/95"
            style={{ height: RULER_HEIGHT }}
          >
            {ticks.map((t) => (
              <div
                key={t.s}
                className="absolute top-0 flex items-center text-[10px] text-slate-500"
                style={{ left: t.x, height: RULER_HEIGHT }}
              >
                <div className="mr-1 h-2 w-px bg-slate-700" />
                {t.label}
              </div>
            ))}
          </div>

          {/* Tracks */}
          <div style={{ paddingTop: 4 }}>
            {project.videoTracks.map((track, i) => (
              <TrackLane
                key={track.id}
                label={track.label ?? `V${i + 1}`}
                color="purple"
                pxPerSec={pxPerSec}
              >
                {track.clips.map((clip) => (
                  <ClipBlock
                    key={clip.id}
                    kind="video"
                    clip={clip}
                    pxPerSec={pxPerSec}
                    selected={selection?.kind === "video" && selection.clipId === clip.id}
                    onClick={() =>
                      onSelect({ kind: "video", trackId: track.id, clipId: clip.id })
                    }
                    onMove={(deltaS) => onMoveClip?.(clip.id, deltaS)}
                    onTrim={(side, deltaS) => onTrimClip?.(clip.id, side, deltaS)}
                  />
                ))}
              </TrackLane>
            ))}

            {project.audioTracks.map((track, i) => (
              <TrackLane
                key={track.id}
                label={track.label ?? `A${i + 1}`}
                color="green"
                pxPerSec={pxPerSec}
              >
                {track.clips.map((clip) => (
                  <ClipBlock
                    key={clip.id}
                    kind="audio"
                    clip={clip}
                    pxPerSec={pxPerSec}
                    selected={selection?.kind === "audio" && selection.clipId === clip.id}
                    onClick={() =>
                      onSelect({ kind: "audio", trackId: track.id, clipId: clip.id })
                    }
                    onMove={(deltaS) => onMoveClip?.(clip.id, deltaS)}
                    onTrim={(side, deltaS) => onTrimClip?.(clip.id, side, deltaS)}
                  />
                ))}
              </TrackLane>
            ))}

            {project.textOverlays.length > 0 && (
              <TrackLane label="T1" color="amber" pxPerSec={pxPerSec}>
                {project.textOverlays.map((o) => {
                  const left = Math.max(0, o.startS * pxPerSec);
                  const width = Math.max(8, o.durationS * pxPerSec);
                  const isSelected = selection?.kind === "overlay" && selection.overlayId === o.id;
                  return (
                    <button
                      key={o.id}
                      onClick={() => onSelect({ kind: "overlay", overlayId: o.id })}
                      className={`absolute top-1 bottom-1 truncate rounded px-2 text-left text-[11px] font-medium transition ${
                        isSelected
                          ? "bg-amber-400/80 text-slate-900 ring-2 ring-amber-200"
                          : "bg-amber-500/30 text-amber-100 hover:bg-amber-500/45"
                      }`}
                      style={{ left, width }}
                      title={o.text}
                    >
                      {o.text || "(text)"}
                    </button>
                  );
                })}
              </TrackLane>
            )}
          </div>

          {/* Playhead */}
          <Playhead currentTimeS={currentTimeS} pxPerSec={pxPerSec} />
        </div>
      </div>
    </div>
  );
}

function buildTicks(totalSeconds: number, pxPerSec: number) {
  const interval =
    pxPerSec >= 120 ? 1 : pxPerSec >= 60 ? 2 : pxPerSec >= 30 ? 5 : 10;
  const ticks: { s: number; x: number; label: string }[] = [];
  for (let s = 0; s <= totalSeconds; s += interval) {
    ticks.push({ s, x: s * pxPerSec, label: formatTimecode(s) });
  }
  return ticks;
}

function formatTimecode(s: number): string {
  const mins = Math.floor(s / 60);
  const secs = Math.floor(s % 60);
  return mins > 0 ? `${mins}:${secs.toString().padStart(2, "0")}` : `${secs}s`;
}

function TrackLane({
  label,
  color,
  pxPerSec: _pxPerSec,
  children,
}: {
  label: string;
  color: "purple" | "green" | "amber";
  pxPerSec: number;
  children: React.ReactNode;
}) {
  const palette = {
    purple: "bg-purple-500/5 border-purple-900/40",
    green:  "bg-green-500/5 border-green-900/40",
    amber:  "bg-amber-500/5 border-amber-900/40",
  }[color];

  return (
    <div
      className={`relative mb-1 border-y ${palette}`}
      style={{ height: TRACK_HEIGHT, marginBottom: TRACK_GAP }}
    >
      <span className="pointer-events-none absolute left-1 top-1 z-10 rounded bg-slate-900/80 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-slate-300">
        {label}
      </span>
      {children}
    </div>
  );
}

function ClipBlock({
  kind,
  clip,
  pxPerSec,
  selected,
  onClick,
  onMove,
  onTrim,
}: {
  kind: "video" | "audio";
  clip: VideoClip | AudioClip;
  pxPerSec: number;
  selected: boolean;
  onClick: () => void;
  onMove: (deltaS: number) => void;
  onTrim: (side: "in" | "out", deltaS: number) => void;
}) {
  const left = Math.max(0, clip.startS * pxPerSec);
  const dur = Math.max(0, clip.outS - clip.inS);
  const width = Math.max(12, dur * pxPerSec);
  const baseStyle: CSSProperties = { left, width };

  const palette = kind === "video"
    ? selected
      ? "bg-purple-400 text-slate-900 ring-2 ring-purple-200"
      : "bg-purple-500/65 text-purple-50 hover:bg-purple-500/85"
    : selected
      ? "bg-green-400 text-slate-900 ring-2 ring-green-200"
      : "bg-green-500/65 text-green-50 hover:bg-green-500/85";

  const label = kind === "video"
    ? clipLabel(clip as VideoClip)
    : audioLabel(clip as AudioClip);

  const dragRef = useRef<{
    mode: "move" | "trimIn" | "trimOut";
    startX: number;
    moved: boolean;
    lastDeltaS: number;
  } | null>(null);

  function pointerDown(mode: "move" | "trimIn" | "trimOut", e: ReactMouseEvent<HTMLDivElement>) {
    e.stopPropagation();
    e.preventDefault();
    dragRef.current = { mode, startX: e.clientX, moved: false, lastDeltaS: 0 };

    function onMouseMove(ev: globalThis.MouseEvent) {
      const d = dragRef.current;
      if (!d) return;
      const deltaPx = ev.clientX - d.startX;
      const deltaS = deltaPx / pxPerSec;
      if (Math.abs(deltaPx) > 2) d.moved = true;
      // Emit absolute delta from the mousedown — caller does +/- math
      const incremental = deltaS - d.lastDeltaS;
      d.lastDeltaS = deltaS;
      if (d.mode === "move") onMove(incremental);
      else if (d.mode === "trimIn") onTrim("in", incremental);
      else onTrim("out", incremental);
    }
    function onMouseUp() {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      dragRef.current = null;
    }
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  }

  return (
    <div
      onMouseDown={(e) => pointerDown("move", e)}
      onClick={(e) => {
        e.stopPropagation();
        if (!dragRef.current?.moved) onClick();
      }}
      className={`absolute top-2 bottom-2 cursor-grab overflow-hidden rounded-sm px-2 text-left text-[11px] font-semibold transition active:cursor-grabbing ${palette}`}
      style={baseStyle}
      title={`${label} · ${dur.toFixed(2)}s`}
    >
      <div className="truncate">{label}</div>
      <div className="truncate text-[10px] opacity-70">{dur.toFixed(2)}s</div>

      {/* Trim handles */}
      <div
        onMouseDown={(e) => pointerDown("trimIn", e)}
        className="absolute left-0 top-0 bottom-0 w-1.5 cursor-ew-resize bg-black/30 hover:bg-black/55"
      />
      <div
        onMouseDown={(e) => pointerDown("trimOut", e)}
        className="absolute right-0 top-0 bottom-0 w-1.5 cursor-ew-resize bg-black/30 hover:bg-black/55"
      />
    </div>
  );
}

function clipLabel(c: VideoClip): string {
  if (c.source.kind === "videoGenerationId") return c.source.ref.slice(0, 8);
  if (c.source.kind === "blob") {
    const last = c.source.ref.split("/").pop() ?? c.source.ref;
    return last.split("?")[0];
  }
  return c.source.ref.slice(0, 24);
}

function audioLabel(c: AudioClip): string {
  if (c.source.kind === "narration") return "🎙 narration";
  if (c.source.kind === "blob") {
    const last = c.source.ref.split("/").pop() ?? c.source.ref;
    return last.split("?")[0];
  }
  return c.source.ref.slice(0, 24);
}

function Playhead({
  currentTimeS,
  pxPerSec,
}: {
  currentTimeS: number;
  pxPerSec: number;
}) {
  const left = Math.max(0, currentTimeS * pxPerSec);
  return (
    <div
      className="pointer-events-none absolute top-0 bottom-0 z-30 w-px bg-red-400"
      style={{ left, boxShadow: "0 0 0 1px rgba(248, 113, 113, 0.35)" }}
    >
      <div className="absolute -top-1 -left-[5px] h-3 w-3 rotate-45 bg-red-400" />
    </div>
  );
}

/**
 * useElementWidth — hook to track a ref's width on resize, used by zoom slider
 * fitting in Phase 4b. Exported now to keep the file’s public surface stable.
 */
export function useElementWidth(): [React.RefObject<HTMLDivElement | null>, number] {
  const ref = useRef<HTMLDivElement | null>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) setW(e.contentRect.width);
    });
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}
