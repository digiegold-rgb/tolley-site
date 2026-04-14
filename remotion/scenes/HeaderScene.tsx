/**
 * HeaderScene — animated title card for topic transitions.
 *
 * Renders centered title + optional subtitle on a dark background with an
 * accent underline. Three animation styles match TubeGen's screenshot 02
 * patterns: slideUp (default), fadeIn, typewriter.
 *
 * Pure CSS + Remotion interpolate — no external deps. Safe for headless
 * Chrome render.
 */
"use client";

import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import type { HeaderData } from "@/lib/vater/video-spec";

export function HeaderScene({
  data,
  durationFrames,
}: {
  data: HeaderData;
  durationFrames: number;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const introFrames = Math.min(Math.round(fps * 0.6), Math.floor(durationFrames * 0.4));
  const outroStart = Math.max(introFrames, durationFrames - Math.round(fps * 0.4));

  // Opacity envelope: fade in at start, hold, fade out at end
  const opacity = interpolate(
    frame,
    [0, introFrames, outroStart, durationFrames],
    [0, 1, 1, 0],
    { extrapolateRight: "clamp" },
  );

  // Slide / position offset
  let translateY = 0;
  if (data.animation === "slideUp") {
    translateY = interpolate(frame, [0, introFrames], [40, 0], {
      extrapolateRight: "clamp",
    });
  }

  // Typewriter: progressively reveal title chars
  const visibleTitle =
    data.animation === "typewriter"
      ? data.title.slice(
          0,
          Math.max(
            1,
            Math.floor(
              interpolate(frame, [0, introFrames * 1.2], [0, data.title.length], {
                extrapolateRight: "clamp",
                extrapolateLeft: "clamp",
              }),
            ),
          ),
        )
      : data.title;

  // Underline grows in width during intro
  const underlineWidth = interpolate(
    frame,
    [introFrames * 0.3, introFrames * 1.1],
    [0, 100],
    { extrapolateRight: "clamp", extrapolateLeft: "clamp" },
  );

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#1a1a2e",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        opacity,
        padding: "0 80px",
      }}
    >
      <div
        style={{
          transform: `translateY(${translateY}px)`,
          textAlign: "center",
          maxWidth: "85%",
        }}
      >
        <h1
          style={{
            margin: 0,
            color: "#ffffff",
            fontSize: 96,
            fontWeight: 800,
            fontFamily:
              "-apple-system, 'Segoe UI', system-ui, 'Inter', sans-serif",
            lineHeight: 1.15,
            letterSpacing: -1,
            textShadow: "0 4px 18px rgba(0,0,0,0.6)",
          }}
        >
          {visibleTitle || "\u00A0"}
        </h1>
        {data.subtitle ? (
          <p
            style={{
              margin: "32px 0 0",
              color: "#cbd5e1",
              fontSize: 38,
              fontWeight: 500,
              fontFamily:
                "-apple-system, 'Segoe UI', system-ui, 'Inter', sans-serif",
            }}
          >
            {data.subtitle}
          </p>
        ) : null}
        <div
          style={{
            margin: "40px auto 0",
            height: 8,
            width: `${underlineWidth}%`,
            maxWidth: "60%",
            backgroundColor: data.accentColor,
            borderRadius: 4,
            boxShadow: `0 0 24px ${data.accentColor}80`,
          }}
        />
      </div>
    </AbsoluteFill>
  );
}
