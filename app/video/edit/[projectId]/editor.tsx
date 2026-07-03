"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Player, type PlayerRef } from "@remotion/player";

import type { Project } from "@/lib/video-editor/types";
import { computeDurationS } from "@/lib/video-editor/defaults";
import {
  TimelineComposition,
  durationInFramesForProject,
} from "@/remotion/TimelineComposition";
import { Timeline, type TimelineSelection } from "@/components/video-editor/timeline";

type EditorProps = {
  projectId: string;
  name: string;
  initialState: Project;
  status: string;
  outputBlobUrl: string | null;
};

const AUTOSAVE_DEBOUNCE_MS = 1500;

export function Editor({
  projectId,
  name: initialName,
  initialState,
  status,
  outputBlobUrl,
}: EditorProps) {
  const [project, setProject] = useState<Project>(initialState);
  const [name, setName] = useState(initialName);
  const [saving, setSaving] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [selection, setSelection] = useState<TimelineSelection>(null);
  const [currentTimeS, setCurrentTimeS] = useState(0);
  const playerRef = useRef<PlayerRef | null>(null);
  const dirtyRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const persist = useCallback(
    async (next: Project, nextName?: string) => {
      setSaving("saving");
      try {
        const res = await fetch(`/api/video/projects/${projectId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            state: next,
            ...(typeof nextName === "string" ? { name: nextName } : {}),
          }),
        });
        if (!res.ok) throw new Error("Save failed");
        setSaving("saved");
        setTimeout(() => setSaving("idle"), 1200);
      } catch {
        setSaving("error");
      }
    },
    [projectId],
  );

  // Debounced autosave when project state changes after first paint
  useEffect(() => {
    if (!dirtyRef.current) {
      dirtyRef.current = true;
      return;
    }
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      void persist(project, name);
    }, AUTOSAVE_DEBOUNCE_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [project, name, persist]);

  const updateProject = useCallback((updater: (p: Project) => Project) => {
    setProject((prev) => {
      const next = updater(structuredClone(prev));
      next.durationS = computeDurationS(next);
      return next;
    });
  }, []);

  // Sync playhead from <Player>
  useEffect(() => {
    const p = playerRef.current;
    if (!p) return;
    const onFrame = (e: { detail: { frame: number } }) => {
      setCurrentTimeS(e.detail.frame / project.fps);
    };
    p.addEventListener("frameupdate", onFrame);
    return () => p.removeEventListener("frameupdate", onFrame);
  }, [project.fps]);

  const seekTo = useCallback(
    (timeS: number) => {
      const p = playerRef.current;
      if (!p) return;
      const frame = Math.round(timeS * project.fps);
      p.seekTo(frame);
      setCurrentTimeS(timeS);
    },
    [project.fps],
  );

  const moveClip = useCallback(
    (clipId: string, deltaS: number) => {
      updateProject((p) => {
        for (const t of p.videoTracks) {
          const c = t.clips.find((c) => c.id === clipId);
          if (c) { c.startS = Math.max(0, c.startS + deltaS); return p; }
        }
        for (const t of p.audioTracks) {
          const c = t.clips.find((c) => c.id === clipId);
          if (c) { c.startS = Math.max(0, c.startS + deltaS); return p; }
        }
        return p;
      });
    },
    [updateProject],
  );

  const trimClip = useCallback(
    (clipId: string, side: "in" | "out", deltaS: number) => {
      updateProject((p) => {
        const findClip = () => {
          for (const t of p.videoTracks) {
            const c = t.clips.find((c) => c.id === clipId);
            if (c) return c;
          }
          for (const t of p.audioTracks) {
            const c = t.clips.find((c) => c.id === clipId);
            if (c) return c;
          }
          return null;
        };
        const c = findClip();
        if (!c) return p;
        const MIN_DUR = 0.1;
        if (side === "in") {
          // Trimming the in-point: shorten the source range AND nudge startS so the
          // tail stays anchored on the timeline (matches every NLE).
          const next = Math.max(0, Math.min(c.outS - MIN_DUR, c.inS + deltaS));
          const applied = next - c.inS;
          c.inS = next;
          c.startS = Math.max(0, c.startS + applied);
        } else {
          c.outS = Math.max(c.inS + MIN_DUR, c.outS + deltaS);
        }
        return p;
      });
    },
    [updateProject],
  );

  const deleteSelected = useCallback(() => {
    if (!selection) return;
    updateProject((p) => {
      if (selection.kind === "video") {
        const t = p.videoTracks.find((t) => t.id === selection.trackId);
        if (t) t.clips = t.clips.filter((c) => c.id !== selection.clipId);
      } else if (selection.kind === "audio") {
        const t = p.audioTracks.find((t) => t.id === selection.trackId);
        if (t) t.clips = t.clips.filter((c) => c.id !== selection.clipId);
      } else if (selection.kind === "overlay") {
        p.textOverlays = p.textOverlays.filter((o) => o.id !== selection.overlayId);
      }
      return p;
    });
    setSelection(null);
  }, [selection, updateProject]);

  // Keyboard shortcuts: Space = play/pause, Delete/Backspace = remove selection
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      if (e.code === "Space") {
        e.preventDefault();
        const p = playerRef.current;
        if (!p) return;
        if (p.isPlaying()) p.pause(); else p.play();
      } else if (e.key === "Delete" || e.key === "Backspace") {
        if (selection) {
          e.preventDefault();
          deleteSelected();
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selection, deleteSelected]);

  return (
    <main className="flex h-screen flex-col bg-slate-950 text-slate-100">
      {/* Top bar */}
      <header className="flex items-center justify-between border-b border-slate-800 bg-slate-900/60 px-4 py-2.5">
        <div className="flex items-center gap-3">
          <Link href="/video/edit" className="text-xs text-slate-500 hover:text-slate-300">
            ← Projects
          </Link>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded bg-transparent px-2 py-1 text-sm font-bold text-white outline-none focus:bg-slate-800/60"
          />
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span
            className={
              saving === "saving"
                ? "text-yellow-300"
                : saving === "saved"
                  ? "text-green-300"
                  : saving === "error"
                    ? "text-red-300"
                    : "text-slate-500"
            }
          >
            {saving === "saving" ? "Saving..." : saving === "saved" ? "Saved" : saving === "error" ? "Save failed" : ""}
          </span>
          <span className="text-slate-500">
            {project.width}×{project.height} · {project.fps}fps · {project.durationS.toFixed(1)}s
          </span>
          <span className="rounded-full border border-slate-700 px-2 py-0.5 text-[10px] uppercase tracking-wider text-slate-400">
            {status}
          </span>
          <button
            disabled
            className="cursor-not-allowed rounded-lg border border-purple-500/30 bg-purple-500/10 px-3 py-1.5 text-xs font-bold text-purple-300 opacity-60"
            title="Render available after Phase 6"
          >
            Render
          </button>
        </div>
      </header>

      {/* Workspace — three columns: media library | preview+timeline | inspector */}
      <div className="grid flex-1 overflow-hidden" style={{ gridTemplateColumns: "260px 1fr 280px" }}>
        {/* Left: Media library (Phase 5) */}
        <aside className="overflow-y-auto border-r border-slate-800 bg-slate-900/30 p-3">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Media
          </p>
          <div className="rounded-lg border border-dashed border-slate-700 bg-slate-900/40 p-4 text-center text-xs text-slate-500">
            Library lands in Phase 5.
            <br />
            Will pull from /video history + narrations.
          </div>
        </aside>

        {/* Center: preview + timeline */}
        <section className="flex flex-col overflow-hidden">
          <div className="flex flex-1 items-center justify-center bg-black p-4">
            <PreviewPlayer project={project} playerRef={playerRef} />
          </div>
          <div className="h-64 border-t border-slate-800 bg-slate-900/40">
            <Timeline
              project={project}
              currentTimeS={currentTimeS}
              selection={selection}
              onSelect={setSelection}
              onSeek={seekTo}
              onMoveClip={(clipId, newStartS) => moveClip(clipId, newStartS)}
              onTrimClip={(clipId, side, deltaS) => trimClip(clipId, side, deltaS)}
            />
          </div>
        </section>

        {/* Right: inspector */}
        <aside className="overflow-y-auto border-l border-slate-800 bg-slate-900/30 p-3">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Inspector
          </p>
          <Inspector project={project} selection={selection} />
        </aside>
      </div>
    </main>
  );
}

function Inspector({
  project,
  selection,
}: {
  project: Project;
  selection: TimelineSelection;
}) {
  if (!selection) {
    return (
      <div className="rounded-lg border border-dashed border-slate-700 bg-slate-900/40 p-4 text-center text-xs text-slate-500">
        Click a clip on the timeline to see its properties.
      </div>
    );
  }

  if (selection.kind === "video") {
    const track = project.videoTracks.find((t) => t.id === selection.trackId);
    const clip = track?.clips.find((c) => c.id === selection.clipId);
    if (!clip) return <NoSelection />;
    const dur = Math.max(0, clip.outS - clip.inS);
    return (
      <div className="space-y-3 text-xs">
        <Field label="Type" value="Video clip" />
        <Field label="Source" value={`${clip.source.kind}: ${clip.source.ref.slice(0, 60)}`} />
        <Field label="Start on timeline" value={`${clip.startS.toFixed(2)}s`} />
        <Field label="Trim in" value={`${clip.inS.toFixed(2)}s`} />
        <Field label="Trim out" value={`${clip.outS.toFixed(2)}s`} />
        <Field label="Duration" value={`${dur.toFixed(2)}s`} />
        {clip.fade && (
          <Field
            label="Fade"
            value={`in ${clip.fade.inS ?? 0}s · out ${clip.fade.outS ?? 0}s`}
          />
        )}
      </div>
    );
  }

  if (selection.kind === "audio") {
    const track = project.audioTracks.find((t) => t.id === selection.trackId);
    const clip = track?.clips.find((c) => c.id === selection.clipId);
    if (!clip) return <NoSelection />;
    const dur = Math.max(0, clip.outS - clip.inS);
    return (
      <div className="space-y-3 text-xs">
        <Field label="Type" value="Audio clip" />
        <Field label="Source" value={clip.source.kind === "narration" ? "Narration (F5-TTS)" : clip.source.ref.slice(0, 60)} />
        <Field label="Start on timeline" value={`${clip.startS.toFixed(2)}s`} />
        <Field label="Duration" value={`${dur.toFixed(2)}s`} />
        <Field label="Volume" value={`${Math.round(clip.volume * 100)}%`} />
      </div>
    );
  }

  if (selection.kind === "overlay") {
    const overlay = project.textOverlays.find((o) => o.id === selection.overlayId);
    if (!overlay) return <NoSelection />;
    return (
      <div className="space-y-3 text-xs">
        <Field label="Type" value="Text overlay" />
        <Field label="Text" value={overlay.text} multiline />
        <Field label="Start" value={`${overlay.startS.toFixed(2)}s`} />
        <Field label="Duration" value={`${overlay.durationS.toFixed(2)}s`} />
        {overlay.position && typeof overlay.position === "string" && (
          <Field label="Position" value={overlay.position} />
        )}
        {overlay.color && <Field label="Color" value={overlay.color} />}
      </div>
    );
  }

  return <NoSelection />;
}

function NoSelection() {
  return (
    <div className="rounded-lg border border-dashed border-slate-700 bg-slate-900/40 p-4 text-center text-xs text-slate-500">
      Selection cleared.
    </div>
  );
}

function Field({
  label,
  value,
  multiline,
}: {
  label: string;
  value: string;
  multiline?: boolean;
}) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</p>
      <p
        className={`mt-0.5 text-slate-200 ${multiline ? "whitespace-pre-wrap" : "truncate"}`}
        title={value}
      >
        {value}
      </p>
    </div>
  );
}

function PreviewPlayer({
  project,
  playerRef,
}: {
  project: Project;
  playerRef: React.RefObject<PlayerRef | null>;
}) {
  // Re-mount Player when fps/size change so the canvas resizes correctly,
  // but let inputProps updates flow through without a remount.
  const compKey = `${project.fps}x${project.width}x${project.height}`;
  const durationInFrames = useMemo(() => durationInFramesForProject(project), [project]);

  if (project.durationS <= 0) {
    return (
      <div className="text-center text-xs text-slate-600">
        Preview will appear once you drop a clip onto the timeline.
        <br />
        <span className="text-slate-700">
          (Player is wired — empty timeline = nothing to play.)
        </span>
      </div>
    );
  }

  return (
    <div
      className="overflow-hidden rounded-md ring-1 ring-slate-800"
      style={{ aspectRatio: `${project.width} / ${project.height}`, maxHeight: "100%", maxWidth: "100%", width: "min(100%, 1280px)" }}
    >
      <Player
        ref={playerRef}
        key={compKey}
        component={TimelineComposition}
        inputProps={{ project }}
        compositionWidth={project.width}
        compositionHeight={project.height}
        fps={project.fps}
        durationInFrames={durationInFrames}
        controls
        loop
        style={{ width: "100%", height: "100%" }}
        clickToPlay
      />
    </div>
  );
}
