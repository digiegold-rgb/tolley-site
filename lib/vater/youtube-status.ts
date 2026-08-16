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
  // Accepted by the DGX but parked behind the per-tenant concurrency cap
  // (content-autopilot 9cbe9a6). In-flight, not an error — it becomes a real
  // render phase as soon as a slot frees.
  | "queued"
  | "fetching"
  | "transcribing"
  | "transcribed"
  | "awaiting_context"
  | "extracting_principles"
  | "scripting"
  | "verifying"
  | "scripted"
  | "awaiting_script_approval"
  | "generating_audio"
  | "aligning_captions"
  | "generating_scenes"
  | "composing_video"
  | "ready"
  | "failed";

export const STATUS_LABELS: Record<YouTubeProjectStatus, string> = {
  draft: "Draft",
  queued: "Queued...",
  fetching: "Fetching source...",
  transcribing: "Transcribing...",
  transcribed: "Transcribed",
  awaiting_context: "Needs context",
  extracting_principles: "Extracting principles...",
  scripting: "Writing script...",
  verifying: "Verifying script...",
  scripted: "Script ready",
  awaiting_script_approval: "Script review",
  generating_audio: "Generating voice...",
  aligning_captions: "Aligning captions...",
  generating_scenes: "Generating scenes...",
  composing_video: "Composing video...",
  ready: "Ready",
  failed: "Failed",
};

export const STATUS_COLORS: Record<YouTubeProjectStatus, string> = {
  draft: "text-zinc-400 bg-zinc-400/10",
  queued: "text-amber-400 bg-amber-400/10 animate-pulse",
  fetching: "text-yellow-400 bg-yellow-400/10 animate-pulse",
  transcribing: "text-yellow-400 bg-yellow-400/10 animate-pulse",
  transcribed: "text-sky-400 bg-sky-400/10",
  awaiting_context: "text-amber-400 bg-amber-400/10",
  extracting_principles: "text-yellow-400 bg-yellow-400/10 animate-pulse",
  scripting: "text-yellow-400 bg-yellow-400/10 animate-pulse",
  verifying: "text-yellow-400 bg-yellow-400/10 animate-pulse",
  scripted: "text-sky-400 bg-sky-400/10",
  awaiting_script_approval: "text-violet-400 bg-violet-400/10",
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
  // Queued jobs MUST keep polling — nothing else moves them off the queue.
  "queued",
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
    status: "awaiting_script_approval",
    label: "Review",
    description:
      "Human approval gate — nothing is generated until the script is approved",
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
  // Per-tenant queue (content-autopilot 9cbe9a6). The DGX emits the position
  // inline — "queued (#3 in line)" — so match the prefix, not the whole
  // string. Keeps the project in-flight so /poll keeps running.
  if (phase.startsWith("queued")) return "queued";

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
    // `stopAfterScript` runs end here: the worker parks after the `scripted`
    // checkpoint and waits for a human to approve in the Script Review screen.
    case "script_ready":
      return "awaiting_script_approval";
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

/**
 * Human label for a queued job. The DGX phase already carries the position
 * ("queued (#3 in line)"), and `JobStatus.queuePosition` carries it as a
 * number — prefer the number, fall back to parsing the phase text.
 *
 * Returns null when the job isn't queued, so callers can do:
 *   queueLabel(phase, job.queuePosition) ?? STATUS_LABELS[status]
 */
export function queueLabel(
  phase: string | null | undefined,
  queuePosition?: number | null,
): string | null {
  if (!phase || !phase.startsWith("queued")) return null;
  const n =
    typeof queuePosition === "number" && queuePosition > 0
      ? queuePosition
      : Number(/#(\d+)/.exec(phase)?.[1]) || null;
  return n ? `Queued \u2014 #${n} in line` : "Queued";
}

export const WORDS_PER_MINUTE = 150;

export function wordCountForDuration(minutes: number): number {
  return Math.round(minutes * WORDS_PER_MINUTE);
}

/**
 * Resolve the URL a `<video>` element should actually load for a project.
 *
 * Finals rendered after 2026-08-07 live on Vercel Blob (`*.blob.vercel-
 * storage.com`), a global edge CDN with proper Range support. When that's
 * the case we point the player STRAIGHT at the blob so every seek/buffer
 * request hits the CDN edge — NOT the `/api/vater/youtube/[id]/video`
 * proxy, which runs auth() + a Prisma lookup + a 302 redirect on every
 * single Range request the browser makes (dozens per playthrough, each
 * with serverless cold-start latency). That per-range serverless hop is
 * what made playback stutter/re-buffer on external connections.
 *
 * Legacy finals still stored behind the DGX Cloudflare tunnel have a
 * relative `finalVideoUrl` (`/vater/file/<jobId>/video`); those keep using
 * the proxy route, which re-wraps the tunnel fetch with the server-side
 * bearer.
 *
 * The blob URL is public-but-unguessable (same model as b2b-videos/), and
 * the proxy route already 302-redirects to this exact URL — so serving it
 * directly exposes nothing that wasn't already visible in the Network tab.
 */
export function finalVideoPlaybackUrl(p: {
  id: string;
  finalVideoUrl?: string | null;
}): string {
  const proxy = `/api/vater/youtube/${p.id}/video`;
  const url = p.finalVideoUrl;
  if (url && url.startsWith("https://")) {
    try {
      if (new URL(url).hostname.endsWith(".blob.vercel-storage.com")) {
        return url;
      }
    } catch {
      /* malformed — fall back to the proxy */
    }
  }
  return proxy;
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
