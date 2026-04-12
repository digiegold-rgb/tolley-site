/**
 * Status, label, color, and pipeline-step constants for the vater/youtube
 * tubegen-quality rebuild. Mirrors the 15-value status flow defined in
 * `/home/jelly/.claude/plans/soft-coalescing-walrus.md`.
 *
 * NOTE for the UI agent: `ELEVENLABS_VOICES` is intentionally left as a
 * deprecated empty array so existing components compile until you replace it
 * with the live `/api/vater/voices` data. Remove it once `youtube-voice-picker`
 * has been switched to the new voice clone picker.
 */

export const WORDS_PER_MINUTE = 150;

export const DURATION_OPTIONS = [10, 20, 30] as const;
export type DurationOption = (typeof DURATION_OPTIONS)[number];

export function wordCountForDuration(minutes: number): number {
  return minutes * WORDS_PER_MINUTE;
}

// ---------------------------------------------------------------------------
// Status flow (15 values) — keep in sync with vater.py phase mapping in
// `app/api/vater/youtube/[id]/poll/route.ts`.
// ---------------------------------------------------------------------------
export type YouTubeProjectStatus =
  | "draft"
  | "fetching"
  | "transcribing"
  | "transcribed"
  | "awaiting_context"
  | "extracting_principles"
  | "scripting"
  | "verifying"
  | "scripted"
  | "generating_audio"
  | "aligning_captions"
  | "generating_scenes"
  | "composing_video"
  | "ready"
  | "failed";

export const STATUS_LABELS: Record<YouTubeProjectStatus, string> = {
  draft: "Draft",
  fetching: "Fetching source...",
  transcribing: "Transcribing...",
  transcribed: "Transcribed",
  awaiting_context: "Awaiting context",
  extracting_principles: "Extracting principles...",
  scripting: "Writing script...",
  verifying: "Verifying script...",
  scripted: "Script ready",
  generating_audio: "Generating voice...",
  aligning_captions: "Aligning captions...",
  generating_scenes: "Generating scenes...",
  composing_video: "Composing video...",
  ready: "Ready",
  failed: "Failed",
};

const PULSE = "animate-pulse";
export const STATUS_COLORS: Record<YouTubeProjectStatus, string> = {
  draft: "text-zinc-400 bg-zinc-400/10",
  fetching: `text-yellow-400 bg-yellow-400/10 ${PULSE}`,
  transcribing: `text-yellow-400 bg-yellow-400/10 ${PULSE}`,
  transcribed: "text-sky-400 bg-sky-400/10",
  awaiting_context: "text-amber-400 bg-amber-400/10",
  extracting_principles: `text-yellow-400 bg-yellow-400/10 ${PULSE}`,
  scripting: `text-yellow-400 bg-yellow-400/10 ${PULSE}`,
  verifying: `text-yellow-400 bg-yellow-400/10 ${PULSE}`,
  scripted: "text-emerald-400 bg-emerald-400/10",
  generating_audio: `text-yellow-400 bg-yellow-400/10 ${PULSE}`,
  aligning_captions: `text-yellow-400 bg-yellow-400/10 ${PULSE}`,
  generating_scenes: `text-yellow-400 bg-yellow-400/10 ${PULSE}`,
  composing_video: `text-yellow-400 bg-yellow-400/10 ${PULSE}`,
  ready: "text-emerald-400 bg-emerald-400/10",
  failed: "text-red-400 bg-red-400/10",
};

/** Statuses where the UI should be polling `/api/vater/youtube/[id]/poll`. */
export const IN_FLIGHT_STATUSES: YouTubeProjectStatus[] = [
  "fetching",
  "transcribing",
  "extracting_principles",
  "scripting",
  "verifying",
  "generating_audio",
  "aligning_captions",
  "generating_scenes",
  "composing_video",
];

/** Terminal statuses — UI should stop polling. */
export const TERMINAL_STATUSES: YouTubeProjectStatus[] = ["ready", "failed"];

// ---------------------------------------------------------------------------
// Pipeline step indicator (UI uses this to render the progress rail)
// ---------------------------------------------------------------------------
export const PIPELINE_STEPS = [
  {
    key: "fetch",
    label: "Fetch",
    icon: "📡",
    description: "Download source audio (transcribe mode)",
    statuses: ["fetching", "transcribing"] as YouTubeProjectStatus[],
  },
  {
    key: "context",
    label: "Context",
    icon: "🎯",
    description: "Goal, length, voice, style",
    statuses: ["transcribed", "awaiting_context"] as YouTubeProjectStatus[],
  },
  {
    key: "script",
    label: "Script",
    icon: "✍️",
    description: "Extract principles, write & verify the script",
    statuses: [
      "extracting_principles",
      "scripting",
      "verifying",
      "scripted",
    ] as YouTubeProjectStatus[],
  },
  {
    key: "voice",
    label: "Voice",
    icon: "🎙️",
    description: "F5-TTS voice clone + caption alignment",
    statuses: ["generating_audio", "aligning_captions"] as YouTubeProjectStatus[],
  },
  {
    key: "scenes",
    label: "Scenes",
    icon: "🎨",
    description: "SDXL imagery for each beat",
    statuses: ["generating_scenes"] as YouTubeProjectStatus[],
  },
  {
    key: "compose",
    label: "Compose",
    icon: "🎞️",
    description: "Remotion stitches it together",
    statuses: ["composing_video"] as YouTubeProjectStatus[],
  },
  {
    key: "ready",
    label: "Ready",
    icon: "🎬",
    description: "Final MP4",
    statuses: ["ready"] as YouTubeProjectStatus[],
  },
] as const;

export type PipelineStepKey = (typeof PIPELINE_STEPS)[number]["key"];

// ---------------------------------------------------------------------------
// Style presets — mirror of the 8 in `vater.py` (single source of truth on DGX)
// ---------------------------------------------------------------------------
export type StylePresetId =
  | "cinematic"
  | "comic_book"
  | "anime"
  | "pixel_art"
  | "pixar"
  | "digital_art"
  | "watercolor"
  | "low_poly";

export interface StylePreset {
  id: StylePresetId;
  name: string;
  prompt: string;
}

export const STYLE_PRESETS: StylePreset[] = [
  {
    id: "cinematic",
    name: "Cinematic",
    prompt:
      "cinematic photograph, dramatic lighting, shallow depth of field, 8k",
  },
  {
    id: "comic_book",
    name: "Comic Book",
    prompt:
      "comic book panel, bold lines, halftone shading, dynamic composition",
  },
  {
    id: "anime",
    name: "Anime",
    prompt:
      "anime illustration, Studio Ghibli style, vibrant colors, detailed background",
  },
  {
    id: "pixel_art",
    name: "Pixel Art",
    prompt: "16-bit pixel art, retro game aesthetic, limited palette",
  },
  {
    id: "pixar",
    name: "Pixar 3D",
    prompt:
      "Pixar 3D render, soft lighting, expressive, children's film aesthetic",
  },
  {
    id: "digital_art",
    name: "Digital Art",
    prompt: "digital painting, ArtStation trending, detailed, matte",
  },
  {
    id: "watercolor",
    name: "Watercolor",
    prompt:
      "watercolor illustration, soft edges, paper texture, loose brushwork",
  },
  {
    id: "low_poly",
    name: "Low Poly",
    prompt: "low poly 3D, flat shading, geometric, minimalist",
  },
];

// ---------------------------------------------------------------------------
// DEPRECATED — TODO(ui-agent): replace with live data from `/api/vater/voices`
// once the new voice clone panel ships. Kept here so existing components
// (`youtube-voice-picker.tsx`) compile in the meantime.
// ---------------------------------------------------------------------------
export interface ElevenLabsVoice {
  id: string;
  name: string;
  gender: "male" | "female" | "neutral";
  accent: string;
}

/** @deprecated UI agent will replace this with live voice clones from `/api/vater/voices`. */
export const ELEVENLABS_VOICES: ElevenLabsVoice[] = [];
