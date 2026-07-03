"use client";

/**
 * VideoSpeedChips — drop-in playback-speed control for any <video> element.
 *
 * Usage:
 *   const ref = useRef<HTMLVideoElement>(null);
 *   <video ref={ref} controls src={...} />
 *   <VideoSpeedChips videoRef={ref} />
 *
 * Renders 1x / 1.5x / 2x / 4x chips. Clicking sets `videoRef.current.playbackRate`
 * and highlights the active chip. Survives ref changes (re-checks current rate
 * whenever the player surfaces a `ratechange` event). Pure client side; no deps.
 */
import { useCallback, useEffect, useState, type RefObject } from "react";

const SPEEDS = [1, 1.5, 2, 4] as const;
type Speed = (typeof SPEEDS)[number];

type Props = {
  videoRef: RefObject<HTMLVideoElement | null>;
  /** Tailwind classes for the wrapper. Default sits below the video. */
  className?: string;
  /** When true, chips render larger (good for primary players). */
  large?: boolean;
};

export function VideoSpeedChips({ videoRef, className = "", large }: Props) {
  const [rate, setRate] = useState<Speed>(1);

  // Sync local state from the underlying element so external changes (e.g.
  // keyboard shortcut, user picking a speed in the native context menu) keep
  // the active chip correct.
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    const handler = () => {
      const r = el.playbackRate;
      const matched = SPEEDS.find((s) => Math.abs(s - r) < 0.01);
      if (matched) setRate(matched);
    };
    handler();
    el.addEventListener("ratechange", handler);
    return () => {
      el.removeEventListener("ratechange", handler);
    };
  }, [videoRef]);

  const apply = useCallback(
    (s: Speed) => {
      const el = videoRef.current;
      if (!el) return;
      el.playbackRate = s;
      setRate(s);
    },
    [videoRef],
  );

  const sizeCls = large
    ? "px-3 py-1.5 text-xs"
    : "px-2 py-1 text-[10px]";

  return (
    <div
      className={`flex items-center gap-1 ${className}`}
      role="group"
      aria-label="Playback speed"
    >
      <span className={`mr-1 uppercase tracking-wider text-zinc-500 ${large ? "text-[10px]" : "text-[9px]"}`}>
        speed
      </span>
      {SPEEDS.map((s) => {
        const active = rate === s;
        return (
          <button
            key={s}
            type="button"
            onClick={() => apply(s)}
            aria-pressed={active}
            className={`${sizeCls} rounded font-semibold transition-colors ${
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
  );
}
