"use client";

/**
 * Client-side Remotion composition for the vater/youtube post-generation editor.
 *
 * Ported from content-autopilot/remotion/src/compositions/VaterSlideshow.tsx — same
 * scene timing, ken burns, fade, karaoke captions, and title card. Overlays from
 * the animation library are deliberately NOT rendered here:
 *   - Overlay rendering requires the full overlay router + animation bundle
 *     that lives on the DGX Remotion project.
 *   - Preview fidelity for "is scene 3 the right image / is the cut right" does
 *     not need overlays.
 *   - The overlays array still round-trips through the editor, so the server
 *     render at publish time renders them normally.
 *
 * If the Player drifts from the server render later, revisit this and either
 * port the animation library or switch the server render to `renderMedia` from
 * this same file.
 */
import {
  AbsoluteFill,
  Audio,
  Img,
  Sequence,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { SceneSpec, VideoSpec } from "@/lib/vater/video-spec";
import { ChartScene } from "./scenes/ChartScene";
import { MapScene } from "./scenes/MapScene";
import { HeaderScene } from "./scenes/HeaderScene";

const FADE_SECONDS = 0.5;
const CAPTION_WINDOW_SECONDS = 3.5;

export type VaterCompositionProps = VideoSpec;

/**
 * Total frame count for a given spec at a given fps. Needed by <Player> so it
 * knows how long the timeline is. Stays in sync with the DGX side which also
 * computes durationInFrames from audioDurationSeconds.
 */
export function durationInFramesForSpec(
  spec: VideoSpec,
  fps: number,
): number {
  return Math.max(fps, Math.ceil(spec.audioDurationSeconds * fps));
}

export function VaterComposition({
  audioUrl,
  audioDurationSeconds,
  scenes,
  captions,
  title,
}: VaterCompositionProps) {
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      {audioUrl ? <Audio src={audioUrl} /> : null}

      {scenes.map((scene) => {
        const fromFrame = Math.max(0, Math.floor(scene.startS * fps));
        const durationFrames = Math.max(
          1,
          Math.ceil((scene.endS - scene.startS) * fps),
        );
        return (
          <Sequence
            key={`${scene.idx}-v${scene.version ?? 0}`}
            from={fromFrame}
            durationInFrames={durationFrames}
            name={`scene-${scene.idx}`}
          >
            <SceneRouter scene={scene} durationFrames={durationFrames} />
          </Sequence>
        );
      })}

      <KaraokeCaptions
        captions={captions}
        audioDurationSeconds={audioDurationSeconds}
      />

      {title ? <TitleCard title={title} /> : null}
    </AbsoluteFill>
  );
}

// ---------------------------------------------------------------------------
// Scene router — picks one of: Header / Chart / Map / Image based on flags.
// Mutually exclusive overlay flags. Any parse failure falls through to
// SceneImage so a bad classifier output never produces a black frame.
// ---------------------------------------------------------------------------
function SceneRouter({
  scene,
  durationFrames,
}: {
  scene: SceneSpec;
  durationFrames: number;
}) {
  if (scene.isHeader && scene.headerData) {
    try {
      return <HeaderScene data={scene.headerData} durationFrames={durationFrames} />;
    } catch {
      /* fall through */
    }
  }
  if (scene.isChart && scene.chartData && scene.chartData.series.length > 0) {
    try {
      return <ChartScene data={scene.chartData} durationFrames={durationFrames} />;
    } catch {
      /* fall through */
    }
  }
  if (scene.isMap && scene.mapData) {
    try {
      return <MapScene data={scene.mapData} durationFrames={durationFrames} />;
    } catch {
      /* fall through */
    }
  }
  return <SceneImage src={scene.imageUrl} durationFrames={durationFrames} />;
}

// ---------------------------------------------------------------------------
// Scene image with ken burns + fade
// ---------------------------------------------------------------------------
function SceneImage({
  src,
  durationFrames,
}: {
  src: string;
  durationFrames: number;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Floor the duration to a safe minimum so interpolate() never sees a
  // collapsed range — bad scene data should still produce a frame.
  const safeDuration = Math.max(2, durationFrames);

  // For a 4-keyframe fade [0, f, d-f, d] we need d > 2f. Cap fadeFrames at
  // floor((d-1)/2). If the scene is too short for even a 1-frame fade, hold
  // opacity at 1.
  const maxFade = Math.floor((safeDuration - 1) / 2);
  const fadeFrames =
    maxFade >= 1 ? Math.min(Math.floor(FADE_SECONDS * fps), maxFade) : 0;
  const opacity =
    fadeFrames >= 1
      ? interpolate(
          frame,
          [0, fadeFrames, safeDuration - fadeFrames, safeDuration],
          [0, 1, 1, 0],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
        )
      : 1;

  // Subtle Ken Burns — safeDuration always >= 2 so [0, safeDuration] is valid.
  const scale = interpolate(frame, [0, safeDuration], [1.0, 1.06], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ opacity }}>
      {src ? (
        <Img
          src={src}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            transform: `scale(${scale})`,
            transformOrigin: "center center",
          }}
        />
      ) : (
        <AbsoluteFill
          style={{
            background:
              "linear-gradient(135deg, #1a1a1a 0%, #0a0a0a 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#555",
            fontFamily: "-apple-system, system-ui, sans-serif",
            fontSize: 32,
          }}
        >
          missing image
        </AbsoluteFill>
      )}
      {/* Darken edges to keep captions readable */}
      <AbsoluteFill
        style={{
          background:
            "linear-gradient(to top, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0) 35%)",
        }}
      />
    </AbsoluteFill>
  );
}

// ---------------------------------------------------------------------------
// Karaoke captions — highlights the active word in a rolling window
// ---------------------------------------------------------------------------
function KaraokeCaptions({
  captions,
}: {
  captions: VaterCompositionProps["captions"];
  audioDurationSeconds: number;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;

  if (captions.length === 0) return null;

  const windowStart = Math.max(0, t - CAPTION_WINDOW_SECONDS / 2);
  const windowEnd = t + CAPTION_WINDOW_SECONDS / 2;
  const visible = captions
    .map((c, i) => ({ ...c, i }))
    .filter((c) => c.end >= windowStart && c.start <= windowEnd);

  if (visible.length === 0) return null;

  return (
    <div
      style={{
        position: "absolute",
        bottom: 96,
        left: 0,
        right: 0,
        display: "flex",
        justifyContent: "center",
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          maxWidth: "85%",
          padding: "20px 36px",
          background: "rgba(0,0,0,0.55)",
          borderRadius: 18,
          fontFamily:
            "-apple-system, 'Segoe UI', system-ui, sans-serif",
          fontSize: 56,
          fontWeight: 700,
          color: "#fff",
          textShadow: "0 2px 8px rgba(0,0,0,0.7)",
          textAlign: "center",
          lineHeight: 1.2,
          letterSpacing: -0.5,
        }}
      >
        {visible.map((w) => {
          const isActive = w.start <= t && t < w.end;
          const isPast = t >= w.end;
          return (
            <span
              key={w.i}
              style={{
                display: "inline-block",
                margin: "0 8px",
                color: isActive ? "#ffd84a" : isPast ? "#bbb" : "#fff",
                transform: isActive ? "scale(1.08)" : "scale(1)",
                transition: "transform 80ms ease-out",
              }}
            >
              {w.word}
            </span>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Title card — fades in/out over the first ~3.5s
// ---------------------------------------------------------------------------
function TitleCard({ title }: { title: string }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const opacity = interpolate(
    frame,
    [0, fps * 0.5, fps * 3, fps * 3.5],
    [0, 1, 1, 0],
    { extrapolateRight: "clamp" },
  );
  return (
    <div
      style={{
        position: "absolute",
        top: 64,
        left: 0,
        right: 0,
        display: "flex",
        justifyContent: "center",
        opacity,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          padding: "12px 24px",
          background: "rgba(0,0,0,0.4)",
          borderRadius: 12,
          color: "#fff",
          fontFamily: "-apple-system, system-ui, sans-serif",
          fontSize: 36,
          fontWeight: 600,
        }}
      >
        {title}
      </div>
    </div>
  );
}
