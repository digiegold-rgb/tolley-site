"use client";

/**
 * TimelineComposition — renders a /video/edit project JSON with Remotion.
 *
 * Same composition runs in three places:
 *   1. The browser <Player> for live preview while editing.
 *   2. The Remotion CLI server-side render on DGX (Phase 6).
 *   3. Frame-by-frame render for thumbnails (future).
 *
 * Mirrors the Sequence + OffthreadVideo + Audio + AbsoluteFill pattern
 * established by VaterComposition.tsx so the two compositions stay
 * conceptually aligned (and either could be unified later if useful).
 */

import * as React from "react";
import {
  AbsoluteFill,
  Audio,
  OffthreadVideo,
  Sequence,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

import type {
  AudioClip,
  Project,
  TextOverlay,
  TextPosition,
  VideoClip,
} from "@/lib/video-editor/types";

const MIN_FRAMES = 1;

export type TimelineCompositionProps = {
  project: Project;
};

export function durationInFramesForProject(project: Project): number {
  const frames = Math.ceil(project.durationS * project.fps);
  return Math.max(project.fps, frames);
}

export function TimelineComposition({ project }: TimelineCompositionProps) {
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      {project.videoTracks.map((track, trackIdx) => (
        <React.Fragment key={track.id}>
          {track.clips.map((clip) => (
            <RenderedVideoClip
              key={clip.id}
              clip={clip}
              fps={fps}
              zIndex={trackIdx + 1}
            />
          ))}
        </React.Fragment>
      ))}

      {project.audioTracks.map((track) => (
        <React.Fragment key={track.id}>
          {track.clips.map((clip) => (
            <RenderedAudioClip key={clip.id} clip={clip} fps={fps} />
          ))}
        </React.Fragment>
      ))}

      {project.textOverlays.map((overlay) => (
        <RenderedTextOverlay key={overlay.id} overlay={overlay} fps={fps} />
      ))}
    </AbsoluteFill>
  );
}

function clipFrames(
  startS: number,
  inS: number,
  outS: number,
  fps: number,
): { from: number; durationInFrames: number } {
  const from = Math.max(0, Math.floor(startS * fps));
  const dur = Math.max(MIN_FRAMES, Math.ceil(Math.max(0, outS - inS) * fps));
  return { from, durationInFrames: dur };
}

function resolveSrc(
  ref: string,
  kind: VideoClip["source"]["kind"] | AudioClip["source"]["kind"],
): string {
  if (ref.startsWith("http://") || ref.startsWith("https://") || ref.startsWith("blob:")) {
    return ref;
  }
  if (kind === "videoGenerationId") {
    // Resolved upstream — should never be a bare ID by the time it hits the
    // composition. Render an empty src so Remotion logs a clear error.
    return "";
  }
  return ref;
}

function RenderedVideoClip({
  clip,
  fps,
  zIndex,
}: {
  clip: VideoClip;
  fps: number;
  zIndex: number;
}) {
  const { from, durationInFrames } = clipFrames(clip.startS, clip.inS, clip.outS, fps);
  const src = resolveSrc(clip.source.ref, clip.source.kind);
  if (!src) return null;

  const fadeInFrames = clip.fade?.inS ? Math.ceil(clip.fade.inS * fps) : 0;
  const fadeOutFrames = clip.fade?.outS ? Math.ceil(clip.fade.outS * fps) : 0;

  return (
    <Sequence from={from} durationInFrames={durationInFrames} layout="none">
      <ClipWithFade
        zIndex={zIndex}
        durationInFrames={durationInFrames}
        fadeInFrames={fadeInFrames}
        fadeOutFrames={fadeOutFrames}
      >
        <OffthreadVideo
          src={src}
          startFrom={Math.floor(clip.inS * fps)}
          endAt={Math.ceil(clip.outS * fps)}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      </ClipWithFade>
    </Sequence>
  );
}

function ClipWithFade({
  zIndex,
  durationInFrames,
  fadeInFrames,
  fadeOutFrames,
  children,
}: {
  zIndex: number;
  durationInFrames: number;
  fadeInFrames: number;
  fadeOutFrames: number;
  children: React.ReactNode;
}) {
  const frame = useCurrentFrame();
  const fadeIn = fadeInFrames > 0 ? interpolate(frame, [0, fadeInFrames], [0, 1], { extrapolateRight: "clamp" }) : 1;
  const fadeOut =
    fadeOutFrames > 0
      ? interpolate(frame, [durationInFrames - fadeOutFrames, durationInFrames], [1, 0], { extrapolateLeft: "clamp" })
      : 1;
  const opacity = Math.min(fadeIn, fadeOut);
  return <AbsoluteFill style={{ opacity, zIndex }}>{children}</AbsoluteFill>;
}

function RenderedAudioClip({ clip, fps }: { clip: AudioClip; fps: number }) {
  const { from, durationInFrames } = clipFrames(clip.startS, clip.inS, clip.outS, fps);
  const src = resolveSrc(clip.source.ref, clip.source.kind);
  if (!src) return null;

  return (
    <Sequence from={from} durationInFrames={durationInFrames} layout="none">
      <Audio
        src={src}
        startFrom={Math.floor(clip.inS * fps)}
        endAt={Math.ceil(clip.outS * fps)}
        volume={Math.max(0, Math.min(1, clip.volume))}
      />
    </Sequence>
  );
}

function positionToCss(pos: TextPosition | undefined): React.CSSProperties {
  if (!pos || pos === "center") {
    return {
      alignItems: "center",
      justifyContent: "center",
      textAlign: "center",
    };
  }
  if (pos === "top")    return { alignItems: "flex-start", justifyContent: "center", textAlign: "center", paddingTop: "8%" };
  if (pos === "bottom") return { alignItems: "flex-end",   justifyContent: "center", textAlign: "center", paddingBottom: "8%" };
  if (pos === "topLeft")    return { alignItems: "flex-start", justifyContent: "flex-start", textAlign: "left",  padding: "5%" };
  if (pos === "topRight")   return { alignItems: "flex-start", justifyContent: "flex-end",   textAlign: "right", padding: "5%" };
  if (pos === "bottomLeft") return { alignItems: "flex-end",   justifyContent: "flex-start", textAlign: "left",  padding: "5%" };
  if (pos === "bottomRight") return { alignItems: "flex-end", justifyContent: "flex-end",   textAlign: "right", padding: "5%" };
  // {x, y} — pixel offsets
  return {
    alignItems: "flex-start",
    justifyContent: "flex-start",
    paddingLeft: pos.x,
    paddingTop: pos.y,
  };
}

function RenderedTextOverlay({ overlay, fps }: { overlay: TextOverlay; fps: number }) {
  const from = Math.max(0, Math.floor(overlay.startS * fps));
  const durationInFrames = Math.max(MIN_FRAMES, Math.ceil(overlay.durationS * fps));
  const enterFrames = overlay.enterAnim && overlay.enterAnim !== "none" ? Math.ceil(0.4 * fps) : 0;
  const exitFrames = overlay.exitAnim && overlay.exitAnim !== "none" ? Math.ceil(0.4 * fps) : 0;

  return (
    <Sequence from={from} durationInFrames={durationInFrames} layout="none">
      <OverlayBody
        overlay={overlay}
        durationInFrames={durationInFrames}
        enterFrames={enterFrames}
        exitFrames={exitFrames}
      />
    </Sequence>
  );
}

function OverlayBody({
  overlay,
  durationInFrames,
  enterFrames,
  exitFrames,
}: {
  overlay: TextOverlay;
  durationInFrames: number;
  enterFrames: number;
  exitFrames: number;
}) {
  const frame = useCurrentFrame();
  const enterAlpha = enterFrames > 0 ? interpolate(frame, [0, enterFrames], [0, 1], { extrapolateRight: "clamp" }) : 1;
  const exitAlpha =
    exitFrames > 0
      ? interpolate(frame, [durationInFrames - exitFrames, durationInFrames], [1, 0], { extrapolateLeft: "clamp" })
      : 1;
  const slideUp = overlay.enterAnim === "slideUp" ? interpolate(frame, [0, enterFrames], [40, 0], { extrapolateRight: "clamp" }) : 0;
  const slideDown = overlay.exitAnim === "slideDown" ? interpolate(frame, [durationInFrames - exitFrames, durationInFrames], [0, 40], { extrapolateLeft: "clamp" }) : 0;
  const opacity = Math.min(enterAlpha, exitAlpha);

  return (
    <AbsoluteFill style={{ display: "flex", ...positionToCss(overlay.position), zIndex: 100 }}>
      <div
        style={{
          opacity,
          transform: `translateY(${slideUp + slideDown}px)`,
          fontFamily: overlay.fontFamily ?? "Inter, system-ui, sans-serif",
          fontWeight: overlay.fontWeight ?? 800,
          fontSize: overlay.fontSize ?? 64,
          color: overlay.color ?? "#fff",
          backgroundColor: overlay.backgroundColor ?? "transparent",
          padding: overlay.backgroundColor ? "0.4em 0.8em" : 0,
          borderRadius: overlay.backgroundColor ? "0.4em" : 0,
          textShadow: overlay.backgroundColor ? "none" : "0 4px 16px rgba(0,0,0,0.55)",
          maxWidth: "85%",
          lineHeight: 1.15,
          whiteSpace: "pre-wrap",
        }}
      >
        {overlay.text}
      </div>
    </AbsoluteFill>
  );
}
