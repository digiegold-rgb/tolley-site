/**
 * MapScene — geographic location card.
 *
 * Phase 3 ships a styled location card with an SVG globe graphic,
 * country/region label, and animated marker dots. Phase 3B will swap in
 * `react-simple-maps` + world-atlas for a real rendered map. The data
 * shape (`MapData`) stays compatible across both implementations so the
 * pipeline classifier doesn't need to change.
 *
 * Renders without any new npm deps — pure SVG + Remotion.
 */
"use client";

import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import type { MapData } from "@/lib/vater/video-spec";

export function MapScene({
  data,
  durationFrames,
}: {
  data: MapData;
  durationFrames: number;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const introFrames = Math.min(Math.round(fps * 0.7), Math.floor(durationFrames * 0.4));
  const opacity = interpolate(
    frame,
    [0, introFrames * 0.5, durationFrames - fps * 0.3, durationFrames],
    [0, 1, 1, 0],
    { extrapolateRight: "clamp" },
  );

  // Animated globe rotation
  const rotation = interpolate(frame, [0, durationFrames], [0, 30], {
    extrapolateRight: "clamp",
  });

  // Marker scale pulse
  const markerScale = interpolate(
    frame,
    [introFrames * 0.6, introFrames * 1.2],
    [0, 1.2],
    { extrapolateRight: "clamp", extrapolateLeft: "clamp" },
  );

  // Caption / region label
  const labelOpacity = interpolate(
    frame,
    [introFrames * 0.8, introFrames * 1.2],
    [0, 1],
    { extrapolateRight: "clamp", extrapolateLeft: "clamp" },
  );

  // Pick a primary location label for display
  const primaryLabel =
    data.markers[0]?.label ||
    (data.scope === "usa" ? "United States" : "Worldwide");

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#0c1426",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        opacity,
        gap: 48,
      }}
    >
      {/* Stylized globe SVG */}
      <svg
        width={420}
        height={420}
        viewBox="0 0 200 200"
        style={{ filter: "drop-shadow(0 8px 32px rgba(56,189,248,0.35))" }}
      >
        <defs>
          <radialGradient id="globe-grad" cx="35%" cy="30%" r="80%">
            <stop offset="0%" stopColor="#38bdf8" />
            <stop offset="60%" stopColor="#0369a1" />
            <stop offset="100%" stopColor="#0c4a6e" />
          </radialGradient>
        </defs>
        {/* Globe body */}
        <circle cx="100" cy="100" r="90" fill="url(#globe-grad)" />
        {/* Lat/lon grid (rotates) */}
        <g transform={`rotate(${rotation} 100 100)`} stroke="#7dd3fc" strokeWidth="0.6" fill="none" opacity="0.55">
          <ellipse cx="100" cy="100" rx="90" ry="22" />
          <ellipse cx="100" cy="100" rx="90" ry="55" />
          <ellipse cx="100" cy="100" rx="80" ry="80" />
          <ellipse cx="100" cy="100" rx="22" ry="90" />
          <ellipse cx="100" cy="100" rx="55" ry="90" />
        </g>
        {/* Continent silhouettes — abstract blob shapes */}
        <g fill="#22c55e" opacity="0.7">
          <path d="M70 60 Q60 75 75 95 T 90 70 Q80 55 70 60 Z" />
          <path d="M115 50 Q130 65 125 85 T 110 75 Q105 55 115 50 Z" />
          <path d="M50 110 Q40 130 65 140 T 75 120 Q60 105 50 110 Z" />
          <path d="M120 115 Q140 130 130 150 T 110 135 Q105 115 120 115 Z" />
        </g>
        {/* Markers — pulsing dots at marker positions */}
        {data.markers.slice(0, 5).map((m, i) => {
          // Project lat/lon naively: lon → x (-180..180 → 10..190), lat → y (90..-90 → 10..190)
          const x = 10 + ((m.lon + 180) / 360) * 180;
          const y = 10 + ((90 - m.lat) / 180) * 180;
          return (
            <g key={i} transform={`translate(${x} ${y}) scale(${markerScale})`}>
              <circle r="6" fill="#fde047" stroke="#7c2d12" strokeWidth="1.5" />
              <circle r="3" fill="#facc15" />
            </g>
          );
        })}
        {/* Highlight glow */}
        <circle cx="100" cy="100" r="92" fill="none" stroke="#7dd3fc" strokeWidth="1" opacity="0.4" />
      </svg>

      <div
        style={{
          opacity: labelOpacity,
          textAlign: "center",
          maxWidth: "80%",
        }}
      >
        <h2
          style={{
            margin: 0,
            color: "#f8fafc",
            fontSize: 64,
            fontWeight: 700,
            fontFamily:
              "-apple-system, 'Segoe UI', system-ui, 'Inter', sans-serif",
            letterSpacing: -0.5,
          }}
        >
          {primaryLabel}
        </h2>
        {data.markers.length > 1 ? (
          <p
            style={{
              margin: "12px 0 0",
              color: "#94a3b8",
              fontSize: 26,
              fontFamily:
                "-apple-system, 'Segoe UI', system-ui, sans-serif",
            }}
          >
            +{data.markers.length - 1} more location{data.markers.length > 2 ? "s" : ""}
          </p>
        ) : null}
      </div>
    </AbsoluteFill>
  );
}
