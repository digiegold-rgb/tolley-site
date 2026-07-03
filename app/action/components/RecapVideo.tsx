"use client";

import { useEffect, useRef } from "react";

// Recap tile that SHOWS what's in the recap — no black boxes. It auto-plays the
// light, silent 480p preview proxy (muted + looping), but only while the tile is
// actually on screen (IntersectionObserver), so a long grid doesn't try to decode
// every recap at once. A click opens the full player modal (full quality + sound +
// fullscreen) — a separate, freshly-mounted element, so switching between recaps
// never reloads/“freaks out” the way the old in-place src-swap did.
export function RecapVideo({ poster, previewSrc, fullSrc, vertical, onOpen }: {
  poster?: string; previewSrc?: string; fullSrc: string; vertical: boolean; onOpen?: () => void;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const inlineSrc = previewSrc || fullSrc;   // prefer the light silent proxy for the grid

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) v.play().catch(() => { /* autoplay quirk — poster stays */ });
          else v.pause();
        }
      },
      { threshold: 0.3 },
    );
    io.observe(v);
    return () => io.disconnect();
  }, []);

  return (
    <div
      style={{ position: "relative", cursor: onOpen ? "pointer" : "default" }}
      onClick={onOpen}
      title="Click to watch full quality with sound / fullscreen"
    >
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <video
        ref={ref}
        src={inlineSrc}
        poster={poster}
        muted
        loop
        playsInline
        preload="metadata"
        style={{
          width: "100%",
          borderRadius: 12,
          background: "#000",
          aspectRatio: vertical ? "9/16" : "16/9",
          maxHeight: vertical ? 420 : undefined,
          objectFit: "contain",
          display: "block",
        }}
      />
      {onOpen && (
        <span style={{
          position: "absolute", right: 8, bottom: 8, fontSize: 11, fontWeight: 700,
          background: "rgba(0,0,0,0.62)", color: "#fff", padding: "3px 8px",
          borderRadius: 999, pointerEvents: "none",
        }}>▶ tap for sound</span>
      )}
    </div>
  );
}
