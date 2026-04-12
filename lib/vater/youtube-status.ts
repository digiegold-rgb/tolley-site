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
    description: "Downloading source media",
    transcribeOnly: true,
  },
  {
    status: "transcribing",
    label: "Transcribe",
    description: "Whisper large-v3 transcription",
    transcribeOnly: true,
  },
  {
    status: "extracting_principles",
    label: "Principles",
    description: "Extracting key claims from source",
    transcribeOnly: true,
  },
  {
    status: "scripting",
    label: "Script",
    description: "Writing original long-form script",
  },
  {
    status: "verifying",
    label: "Verify",
    description: "Checking script against principles",
    transcribeOnly: true,
  },
  {
    status: "generating_audio",
    label: "Voice",
    description: "F5-TTS voice clone narration",
  },
  {
    status: "aligning_captions",
    label: "Captions",
    description: "Word-level forced alignment",
  },
  {
    status: "generating_scenes",
    label: "Scenes",
    description: "SDXL scene imagery (one per beat)",
  },
  {
    status: "composing_video",
    label: "Compose",
    description: "Remotion final render",
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
