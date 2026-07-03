"use client";

/**
 * Site-wide keyboard shortcuts for video playback speed.
 *
 *   1 → 1x   (normal)
 *   2 → 2x
 *   3 → 1.5x
 *   4 → 4x
 *
 * Targets the most-recently-played-or-hovered <video> on the page so the
 * shortcut keeps working even when there's no explicit speed-chip UI.
 *
 * Ignored when the user is typing in an input/textarea/contentEditable, or
 * holding any modifier (Ctrl/Cmd/Alt). Capture-phase listener so it runs
 * before page-level handlers.
 */
import { useEffect, useRef } from "react";

const KEY_TO_RATE: Record<string, number> = {
  "1": 1,
  "2": 2,
  "3": 1.5,
  "4": 4,
};

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (target.isContentEditable) return true;
  return false;
}

export function VideoSpeedKeybinds() {
  const lastVideoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    // Track which <video> the user most recently interacted with (played,
    // paused, hovered). Whatever they touched last is what the keyboard
    // shortcut targets — matches user expectation across multi-video pages.
    const trackVideo = (e: Event) => {
      const t = e.target;
      if (t instanceof HTMLVideoElement) {
        lastVideoRef.current = t;
      }
    };
    const events = ["play", "pause", "seeking", "mouseenter", "click"] as const;
    for (const ev of events) {
      document.addEventListener(ev, trackVideo, true);
    }

    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (isTypingTarget(e.target)) return;
      const rate = KEY_TO_RATE[e.key];
      if (rate === undefined) return;

      // Prefer the last-touched video; fall back to any playing <video>;
      // last resort = the first <video> on the page.
      let target: HTMLVideoElement | null = lastVideoRef.current;
      if (!target || !document.contains(target)) {
        const all = Array.from(document.querySelectorAll("video"));
        target = all.find((v) => !v.paused) ?? all[0] ?? null;
      }
      if (!target) return;
      target.playbackRate = rate;
      lastVideoRef.current = target;
      // Don't preventDefault — let "1/2/3/4" still type into anything we
      // might have missed. Stopping shortcut for typing was already handled
      // by the input-target check above.
    };
    window.addEventListener("keydown", onKey);

    return () => {
      for (const ev of events) {
        document.removeEventListener(ev, trackVideo, true);
      }
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  return null;
}
