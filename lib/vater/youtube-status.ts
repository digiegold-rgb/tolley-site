/**
 * The 15 lifecycle statuses for a VATER YouTubeProject after the
 * tubegen rebuild. These mirror the values written by the autopilot
 * pipeline (vater.py + the poll route) into `YouTubeProject.status`.
 *
 * NOTE: schema agent owns `youtube-types.ts`. UI agent needed a place
 * to define the new status flow without colliding with that file.
 * Both files re-export some shared constants on purpose.
 */

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
  awaiting_context: "Needs context",
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

export const STATUS_COLORS: Record<YouTubeProjectStatus, string> = {
  draft: "text-zinc-400 bg-zinc-400/10",
  fetching: "text-yellow-400 bg-yellow-400/10 animate-pulse",
  transcribing: "text-yellow-400 bg-yellow-400/10 animate-pulse",
  transcribed: "text-sky-400 bg-sky-400/10",
  awaiting_context: "text-amber-400 bg-amber-400/10",
  extracting_principles: "text-yellow-400 bg-yellow-400/10 animate-pulse",
  scripting: "text-yellow-400 bg-yellow-400/10 animate-pulse",
  verifying: "text-yellow-400 bg-yellow-400/10 animate-pulse",
  scripted: "text-sky-400 bg-sky-400/10",
  generating_audio: "text-yellow-400 bg-yellow-400/10 animate-pulse",
  aligning_captions: "text-yellow-400 bg-yellow-400/10 animate-pulse",
  generating_scenes: "text-yellow-400 bg-yellow-400/10 animate-pulse",
  composing_video: "text-yellow-400 bg-yellow-400/10 animate-pulse",
  ready: "text-emerald-400 bg-emerald-400/10",
  failed: "text-red-400 bg-red-400/10",
};

/**
 * Statuses where the UI should keep polling `/poll` for updates.
 * `fetching` + `transcribing` are the fetch-source phase. The rest are
 * the run-creation phase. `awaiting_context` is interactive — no poll.
 */
export const IN_FLIGHT_STATUSES: ReadonlySet<YouTubeProjectStatus> = new Set([
  "fetching",
  "transcribing",
  "extracting_principles",
  "scripting",
  "verifying",
  "generating_audio",
  "aligning_captions",
  "generating_scenes",
  "composing_video",
]);

/**
 * Ordered list of run-creation phases used by `<YouTubeCreationProgress>`
 * to render the step indicator. The first two phases are part of the
 * fetch-source pipeline and only appear in transcribe mode.
 */
export interface CreationPhase {
  status: YouTubeProjectStatus;
  label: string;
  description: string;
  /** Only show this phase in transcribe mode (not topic mode). */
  transcribeOnly?: boolean;
}

export const CREATION_PHASES: readonly CreationPhase[] = [
  {
    status: "fetching",
    label: "Fetch",
    description: "yt-dlp downloads the source media (audio + metadata)",
    transcribeOnly: true,
  },
  {
    status: "transcribing",
    label: "Transcribe",
    description: "faster-whisper large-v3 transcription on DGX",
    transcribeOnly: true,
  },
  {
    status: "extracting_principles",
    label: "Principles",
    description: "Kimi extracts key claims, facts, and angles",
    transcribeOnly: true,
  },
  {
    status: "scripting",
    label: "Script",
    description: "Writing original long-form script in your goal + voice",
  },
  {
    status: "verifying",
    label: "Verify",
    description: "Cross-checks script against extracted principles",
    transcribeOnly: true,
  },
  {
    status: "generating_audio",
    label: "Voice",
    description:
      "ElevenLabs or F5-TTS narration (routed by your selected style)",
  },
  {
    status: "aligning_captions",
    label: "Captions",
    description: "WhisperX word-level forced alignment for karaoke",
  },
  {
    status: "generating_scenes",
    label: "Scenes",
    description:
      "FireRed / SDXL / Gemini scene imagery — one still per beat (5s)",
  },
  {
    status: "composing_video",
    label: "Compose",
    description:
      "Remotion + ffmpeg stitch captions, music, stills into final MP4",
  },
] as const;

/**
 * Map a `JobStatus.phase` from the autopilot client to a project status.
 * Used by the poll route to translate DGX job state into Prisma updates.
 * Keep in sync with the phase strings emitted by vater.py.
 */
export function phaseToStatus(
  phase: string,
): YouTubeProjectStatus | undefined {
  switch (phase) {
    // ---- fetch-source pipeline ----
    case "downloading":
      return "fetching";
    case "transcribing":
      return "transcribing";

    // ---- run-creation pipeline (vater.py emits both "running" and
    //      "ready" variants of every phase; map them to the same status) ----
    case "starting_llm":
      return "extracting_principles";
    case "extracting_principles":
    case "extracted":
      return "extracting_principles";
    case "scripting":
    case "scripted":
      return "scripting";
    case "verifying":
    case "verified":
      return "verifying";
    case "tts":
    case "generating_audio":
    case "audio_ready":
      return "generating_audio";
    case "aligning":
    case "aligning_captions":
    case "captions_ready":
      return "aligning_captions";
    case "prompting":
    case "prompting_scenes":
    case "generating_scenes":
    case "rendering_scenes":
    case "scenes_ready":
    case "annotating_overlays":
      return "generating_scenes";
    case "composing":
    case "composing_video":
    case "rendering":
      return "composing_video";

    // ---- terminal ----
    case "done":
      return "ready";
    case "failed":
      return "failed";

    default:
      return undefined;
  }
}

export const WORDS_PER_MINUTE = 150;

export function wordCountForDuration(minutes: number): number {
  return Math.round(minutes * WORDS_PER_MINUTE);
}

/**
 * True when the baked `final.mp4` predates scene/animation edits — i.e. the
 * editor preview (assembled live from per-scene files) will look different
 * from the library's baked final MP4. UI uses this to surface a
 * "re-compose to refresh final MP4" prompt.
 *
 * Only meaningful for `ready` projects: during compose the status is
 * `composing_video`/`editing` and the preview+final drift is expected.
 */
export function isFinalMp4Stale(p: {
  status: string;
  editedAt: Date | string | null | undefined;
  completedAt: Date | string | null | undefined;
}): boolean {
  if (p.status !== "ready") return false;
  if (!p.editedAt || !p.completedAt) return false;
  return new Date(p.editedAt).getTime() > new Date(p.completedAt).getTime();
}
