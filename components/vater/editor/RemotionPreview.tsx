"use client";

/**
 * Thin wrapper around @remotion/player that consumes a VideoSpec and renders
 * the VaterComposition. Used by the editor's center panel to give instant
 * scrub/play/pause with zero DGX round-trips.
 *
 * The Player is dynamic-imported so the heavy Remotion runtime only lands in
 * the /vater/youtube/[id]/edit route bundle and doesn't bloat the rest of
 * tolley-site.
 */
import { Component, useMemo, useState, type ComponentType, type ReactNode } from "react";
import dynamic from "next/dynamic";
import {
  VaterComposition,
  durationInFramesForSpec,
} from "@/remotion/VaterComposition";
import type { VideoSpec } from "@/lib/vater/video-spec";

// Player is browser-only. Disable SSR so Next.js doesn't try to render it
// on the server — the hydration path picks it up once the bundle loads.
const Player = dynamic(
  () => import("@remotion/player").then((m) => m.Player),
  {
    ssr: false,
    loading: () => (
      <div className="flex aspect-video w-full items-center justify-center rounded-lg border border-zinc-800 bg-black text-xs text-zinc-600">
        Loading preview…
      </div>
    ),
  },
);

class PlayerErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error, info: unknown) {
    // eslint-disable-next-line no-console
    console.error("[RemotionPreview] Player crashed", error, info);
  }
  render() {
    if (this.state.error) {
      return (
        <div className="flex aspect-video w-full flex-col items-center justify-center gap-2 rounded-lg border border-rose-500/40 bg-rose-500/5 p-4 text-center text-xs text-rose-300">
          <p className="font-semibold">Player crashed</p>
          <p className="font-mono text-[10px] text-rose-200/70">
            {this.state.error.message}
          </p>
          <p className="text-[10px] text-rose-200/50">
            Open DevTools → Console for stack trace.
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}

const FPS = 30;
const WIDTH = 1920;
const HEIGHT = 1080;

type Props = {
  spec: VideoSpec;
  className?: string;
};

const SPEEDS = [1, 1.5, 2, 4] as const;

export function RemotionPreview({ spec, className }: Props) {
  const durationInFrames = useMemo(
    () => durationInFramesForSpec(spec, FPS),
    [spec],
  );
  const [playbackRate, setPlaybackRate] = useState<number>(1);

  return (
    <div className="space-y-2">
      <div
        className={
          className ??
          "w-full overflow-hidden rounded-lg border border-zinc-800 bg-black"
        }
      >
        <PlayerErrorBoundary>
          <Player
            component={VaterComposition as ComponentType<Record<string, unknown>>}
            inputProps={spec as Record<string, unknown>}
            durationInFrames={durationInFrames}
            fps={FPS}
            compositionWidth={WIDTH}
            compositionHeight={HEIGHT}
            style={{ width: "100%", aspectRatio: "16 / 9" }}
            controls
            clickToPlay
            doubleClickToFullscreen
            spaceKeyToPlayOrPause
            acknowledgeRemotionLicense
            playbackRate={playbackRate}
          />
        </PlayerErrorBoundary>
      </div>
      <div
        className="flex items-center justify-end gap-1"
        role="group"
        aria-label="Playback speed"
      >
        <span className="mr-1 text-[9px] uppercase tracking-wider text-zinc-500">
          speed
        </span>
        {SPEEDS.map((s) => {
          const active = playbackRate === s;
          return (
            <button
              key={s}
              type="button"
              onClick={() => setPlaybackRate(s)}
              aria-pressed={active}
              className={`rounded px-2 py-1 text-[10px] font-semibold transition-colors ${
                active
                  ? "bg-sky-500/30 text-sky-200 ring-1 ring-sky-400/60"
                  : "bg-zinc-800/70 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200"
              }`}
            >
              {s}x
            </button>
          );
        })}
      </div>
    </div>
  );
}
