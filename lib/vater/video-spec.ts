/**
 * VideoSpec — the single source of truth for a composed vater/youtube video.
 *
 * Mirrors `vaterSlideshowSchema` in content-autopilot/remotion/src/compositions/
 * VaterSlideshow.tsx. Both the client-side Remotion <Player> (for scrub/preview
 * without hitting DGX) and the server-side /vater/compose-video endpoint
 * (which renders via Remotion headless Chrome on DGX) consume this same shape.
 *
 * Any change here MUST be mirrored in the DGX composition, or preview will
 * drift from final render.
 */
import { z } from "zod";

// ---------------------------------------------------------------------------
// Overlay cue — matches the Remotion animations library on the DGX side.
// Phase 1 UI does NOT edit overlays, but we round-trip them on save so the
// server render keeps animating the same way after the user edits other
// fields.
// ---------------------------------------------------------------------------
export const overlayCueSchema = z.object({
  type: z.string(),
  trigger_offset_s: z.number().optional().default(0),
  duration_s: z.number().optional(),
  position: z
    .union([z.string(), z.object({ x: z.string(), y: z.string() })])
    .optional(),
  params: z.record(z.string(), z.unknown()).optional().default({}),
});
export type OverlayCue = z.infer<typeof overlayCueSchema>;

// ---------------------------------------------------------------------------
// Smart Overlay data shapes (Phase 3) — when a scene's isChart/isMap/isHeader
// is set, the Remotion router renders the corresponding component INSTEAD of
// the still image. The classifier in vater.py decides per-scene whether the
// script beat is data-heavy (chart), location-bearing (map), or a topic
// transition (header). Mutually exclusive — only one of the three can fire
// per scene.
// ---------------------------------------------------------------------------
export const chartDataSchema = z.object({
  type: z.enum(["bar", "line", "pie"]).default("bar"),
  title: z.string().optional().default(""),
  labels: z.array(z.string()).default([]),
  series: z
    .array(
      z.object({
        name: z.string(),
        values: z.array(z.number()),
        color: z.string().optional(),
      }),
    )
    .default([]),
  yAxisLabel: z.string().optional(),
  animation: z.enum(["buildUp", "fadeIn", "drawLine"]).default("buildUp"),
});
export type ChartData = z.infer<typeof chartDataSchema>;

export const mapDataSchema = z.object({
  scope: z.enum(["world", "usa"]).default("world"),
  highlightIso: z.array(z.string()).default([]),
  markers: z
    .array(
      z.object({
        lat: z.number(),
        lon: z.number(),
        label: z.string().optional(),
      }),
    )
    .default([]),
  animation: z.enum(["zoomIn", "fadeIn"]).default("fadeIn"),
});
export type MapData = z.infer<typeof mapDataSchema>;

export const headerDataSchema = z.object({
  title: z.string().min(1),
  subtitle: z.string().optional(),
  accentColor: z.string().default("#ffd84a"),
  animation: z.enum(["slideUp", "fadeIn", "typewriter"]).default("slideUp"),
});
export type HeaderData = z.infer<typeof headerDataSchema>;

// ---------------------------------------------------------------------------
// Scene — one image + its time window. `version` is bumped every time the
// user regenerates the image. `imageUrl` is always the latest version URL so
// the Player shows current state without extra plumbing.
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// Animation (i2v) — per-scene image-to-video animation via vater_i2v.
// Matches TubeGen.ai's per-scene animation UX exactly:
//   - `animate`: user toggled "Animate this scene"
//   - `animationPrompt`: free-form motion text (NOT preset dropdowns —
//     TubeGen uses natural language like "Slowly zoom in on the notebook")
//   - `fixedCamera`: when true, appends "hold camera still" to the prompt
//     and sets providerSettings.cameraFixed on Kling-family backends
//   - `animQuality`: turbo | default | default_1080p | high | ltx-local
//   - `videoUrl`: populated after successful animation (serves the MP4)
//   - `videoVersion`: bumped on re-animation (like image `version`)
//   - `animCost`: USD cost of the generated clip (for UI meter)
// ---------------------------------------------------------------------------
export const animationQualitySchema = z.enum([
  "turbo",
  "default",
  "default_1080p",
  "high",
  "kling-standard",
  "kling-pro",
  "kling-master",
  "luma",
  "ltx-local",
  "wan22-local",
  "modal-wan22",
  "modal-wan22-fast",
  "modal-wan22-narrative",
  "modal-wan22-narrative-fast",
  "modal-hunyuan-narrative",
  "modal-hunyuan-narrative-fast",
  "modal-easyanimate-anime",
]);
export type AnimationQuality = z.infer<typeof animationQualitySchema>;

// Motion preset for the Wan2.2 sampler — see MOTION_PRESETS in vater_i2v.py.
// Subtle/normal/bold change cfg, shift, denoise_strength, and lora strength
// together. Only honored by the modal-wan22 / modal-wan22-fast backends.
export const motionIntensitySchema = z.enum(["subtle", "normal", "bold"]);
export type MotionIntensity = z.infer<typeof motionIntensitySchema>;

export const sceneSpecSchema = z.object({
  idx: z.number().int().min(0),
  imageUrl: z.string().optional().default(""),
  videoUrl: z.string().optional(),
  mediaType: z.enum(["image", "video"]).optional().default("image"),
  startS: z.number(),
  endS: z.number(),
  beatText: z.string().optional().default(""),
  imagePrompt: z.string().optional().default(""),
  version: z.number().int().min(0).optional().default(0),
  overlays: z.array(overlayCueSchema).optional().default([]),
  // ── Smart Overlay flags + data (Phase 3) ────────────────────────────────
  isChart: z.boolean().optional().default(false),
  chartData: chartDataSchema.optional(),
  isMap: z.boolean().optional().default(false),
  mapData: mapDataSchema.optional(),
  isHeader: z.boolean().optional().default(false),
  headerData: headerDataSchema.optional(),
  // ── Animation (i2v) — TubeGen-parity fields ─────────────────────────────
  animate: z.boolean().optional().default(false),
  animationPrompt: z.string().optional().default(""),
  fixedCamera: z.boolean().optional().default(false),
  animQuality: animationQualitySchema.optional(),
  videoVersion: z.number().int().min(0).optional().default(0),
  animCost: z.number().optional(),
  animBackend: z.enum(["veo", "ltx", "kling", "fal", "modal"]).optional(),
  animModel: z.string().optional(),
  animDurationSeconds: z.number().optional(),
  // ── Motion dampening controls (2026-04-22) ──────────────────────────────
  // subtle = calm, hold-pose, low-movement narrative (default for new projects)
  // normal = today's behaviour, medium motion
  // bold   = action beats that explicitly want more motion
  motionIntensity: motionIntensitySchema.optional().default("normal"),
  // When true, Modal reuses the start image as the FLF2V end-frame → clamps
  // ending pose, killing wandering limbs/mouth on calm scenes.
  holdStartPose: z.boolean().optional().default(false),
});
export type SceneSpec = z.infer<typeof sceneSpecSchema>;

// ---------------------------------------------------------------------------
// Caption word — matches YouTubeProject.captionTimings in Prisma.
// ---------------------------------------------------------------------------
export const captionWordSchema = z.object({
  word: z.string(),
  start: z.number(),
  end: z.number(),
});
export type CaptionWord = z.infer<typeof captionWordSchema>;

// ---------------------------------------------------------------------------
// Full video spec. Matches vaterSlideshowSchema on the DGX side.
// ---------------------------------------------------------------------------
export const videoSpecSchema = z.object({
  audioUrl: z.string(),
  audioDurationSeconds: z.number(),
  scenes: z.array(sceneSpecSchema),
  captions: z.array(captionWordSchema),
  title: z.string().optional().default(""),
});
export type VideoSpec = z.infer<typeof videoSpecSchema>;

// ---------------------------------------------------------------------------
// Build a VideoSpec from a raw YouTubeProject row. Tolerant of legacy rows
// that are missing any of the optional fields (older pipeline runs wrote
// `scenesJson` without version / overlays / imagePrompt).
// ---------------------------------------------------------------------------
type YouTubeProjectLike = {
  id: string;
  audioUrl: string | null;
  audioDuration: number | null;
  scenesJson: unknown;
  captionTimings: unknown;
  sourceTitle: string | null;
  topic: string | null;
};

export function buildVideoSpec(project: YouTubeProjectLike): VideoSpec | null {
  if (!project.audioUrl || !project.audioDuration) return null;

  const rawScenes = Array.isArray(project.scenesJson) ? project.scenesJson : [];
  const scenes: SceneSpec[] = rawScenes
    .map((s, i) => {
      const raw = (s ?? {}) as Record<string, unknown>;
      const parsed = sceneSpecSchema.safeParse({
        idx: typeof raw.idx === "number" ? raw.idx : i,
        imageUrl: typeof raw.imageUrl === "string" ? raw.imageUrl : "",
        videoUrl: typeof raw.videoUrl === "string" ? raw.videoUrl : undefined,
        mediaType: raw.mediaType === "video" ? "video" : "image",
        startS: typeof raw.startS === "number" ? raw.startS : 0,
        endS: typeof raw.endS === "number" ? raw.endS : 0,
        beatText: typeof raw.beatText === "string" ? raw.beatText : "",
        imagePrompt:
          typeof raw.imagePrompt === "string" ? raw.imagePrompt : "",
        version: typeof raw.version === "number" ? raw.version : 0,
        overlays: Array.isArray(raw.overlays) ? raw.overlays : [],
        // Smart Overlay flags — back-compat: legacy rows have none of these
        isChart: raw.isChart === true,
        chartData: raw.chartData as Record<string, unknown> | undefined,
        isMap: raw.isMap === true,
        mapData: raw.mapData as Record<string, unknown> | undefined,
        isHeader: raw.isHeader === true,
        headerData: raw.headerData as Record<string, unknown> | undefined,
        // Animation (i2v) — back-compat: legacy rows have none of these
        animate: raw.animate === true,
        animationPrompt:
          typeof raw.animationPrompt === "string" ? raw.animationPrompt : "",
        fixedCamera: raw.fixedCamera === true,
        animQuality:
          typeof raw.animQuality === "string" ? raw.animQuality : undefined,
        videoVersion:
          typeof raw.videoVersion === "number" ? raw.videoVersion : 0,
        animCost: typeof raw.animCost === "number" ? raw.animCost : undefined,
        animBackend:
          typeof raw.animBackend === "string" ? raw.animBackend : undefined,
        animModel:
          typeof raw.animModel === "string" ? raw.animModel : undefined,
        animDurationSeconds:
          typeof raw.animDurationSeconds === "number"
            ? raw.animDurationSeconds
            : undefined,
        motionIntensity:
          raw.motionIntensity === "subtle" ||
          raw.motionIntensity === "normal" ||
          raw.motionIntensity === "bold"
            ? raw.motionIntensity
            : "normal",
        holdStartPose: raw.holdStartPose === true,
      });
      return parsed.success ? parsed.data : null;
    })
    .filter((s): s is SceneSpec => s !== null);

  if (scenes.length === 0) return null;

  const rawCaptions = Array.isArray(project.captionTimings)
    ? project.captionTimings
    : [];
  const captions: CaptionWord[] = rawCaptions
    .map((c) => {
      const parsed = captionWordSchema.safeParse(c);
      return parsed.success ? parsed.data : null;
    })
    .filter((c): c is CaptionWord => c !== null);

  return {
    audioUrl: project.audioUrl,
    audioDurationSeconds: project.audioDuration,
    scenes,
    captions,
    title: project.sourceTitle || project.topic || "",
  };
}
