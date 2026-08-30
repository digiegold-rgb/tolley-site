import { isStuckBeforeReadyStatus, rowLooksFileReady, type DeliveryRow } from "./delivery-ready";

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
  | "failed"
  // Fable 5 Concierge lane (2026-08-19). A human-directed render: the ticket
  // lives on `settingsJson.concierge`; the customer sees stage chips, never
  // DGX phases. Delivered = `ready`, cancelled = `scripted`. NOT in-flight —
  // the editor polls GET /api/vater/youtube/[id], never /poll.
  | "concierge_queued"
  | "concierge_in_progress"
  | "concierge_needs_info"
  // Stepped create flow (2026-08-28). `awaiting_engine` = script approved
  // (free) and the project is parked on step 6 until the customer picks
  // Jelly/Fable — the ONLY money click. `expired` = an approval gate
  // (step 5/6) sat untouched for 7 days; lazily flipped on read by
  // lib/vater/approval-expiry.ts, reopened via POST [id]/reopen.
  | "awaiting_engine"
  | "expired"
  // Editor write in progress (scene regen / overlay / compose). Was used at
  // runtime for months without being in the union — see customerStage().
  | "editing";

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
  concierge_queued: "Fable 5 — in queue",
  concierge_in_progress: "Fable 5 — in the studio",
  concierge_needs_info: "Fable 5 — needs your input",
  awaiting_engine: "Choose engine",
  expired: "Expired — reopen to continue",
  editing: "Finishing edit…",
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
  concierge_queued: "text-violet-400 bg-violet-400/10",
  concierge_in_progress: "text-violet-400 bg-violet-400/10 animate-pulse",
  concierge_needs_info: "text-amber-400 bg-amber-400/10",
  awaiting_engine: "text-violet-400 bg-violet-400/10",
  expired: "text-zinc-500 bg-zinc-500/10",
  editing: "text-yellow-400 bg-yellow-400/10 animate-pulse",
};

/**
 * Fable 5 Concierge statuses. A project in one of these is owned by the
 * concierge lane: the customer's editor steps are disabled (except
 * needs_info), Queue/Dashboard count it as active, and the auto pipeline's
 * /poll route is never called for it.
 */
export const CONCIERGE_STATUSES: ReadonlySet<YouTubeProjectStatus> = new Set<
  YouTubeProjectStatus
>(["concierge_queued", "concierge_in_progress", "concierge_needs_info"]);

export function isConciergeStatus(
  s: string | null | undefined,
): s is "concierge_queued" | "concierge_in_progress" | "concierge_needs_info" {
  return !!s && CONCIERGE_STATUSES.has(s as YouTubeProjectStatus);
}

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
 * The three stages a customer should be able to read at a glance on
 * Library and Queue. This is a grouping of the existing statuses — not a
 * second status enum.
 *
 *   queued      → `queued` + `concierge_queued`
 *   in_progress → other IN_FLIGHT_STATUSES + `concierge_in_progress`
 *   done        → `ready` (delivered concierge flips to `ready`)
 *
 * Chip copy still comes from STATUS_LABELS / CUSTOMER_STAGE_LABELS.
 * Parked drafts, script review, failed, and `concierge_needs_info` stay
 * on STATUS_LABELS and are not forced into this journey.
 */
export type CustomerStage = "queued" | "in_progress" | "done";

export const CUSTOMER_STAGE_ORDER: readonly CustomerStage[] = [
  "queued",
  "in_progress",
  "done",
] as const;

export const CUSTOMER_STAGE_LABELS: Record<CustomerStage, string> = {
  queued: "Queued",
  in_progress: "In progress",
  done: "Done",
};

/** Waiting in line — not yet being worked. Subset of IN_FLIGHT + concierge. */
export const QUEUED_STATUSES: ReadonlySet<YouTubeProjectStatus> = new Set([
  "queued",
  "concierge_queued",
]);

/**
 * What `customerStage` needs beyond `status` to place an `editing` row.
 * `editing` is not a pipeline status — every editor write (scene regen,
 * overlay, animate, compose) sets it and only a sync flips it back to
 * `ready`. An abandoned/cancelled edit therefore strands the row on
 * `editing` forever, and on status alone it read as "In progress —
 * Refreshing final…" (#3 and #6 sat there for 10+ days, 2026-08-25).
 * Pass the row so liveness can be judged; a bare status string keeps the
 * legacy optimistic reading.
 */
export interface CustomerStageInput extends DeliveryRow {
  status: string | null | undefined;
  updatedAt?: string | Date | null;
}

/** An edit is "live" for this long after its last write, then it is stale. */
export const EDITING_LIVE_WINDOW_MS = 2 * 60 * 60 * 1000;

/** Chip phrase for a live `editing` row (not a YouTubeProjectStatus, so it
 *  lives here rather than in STATUS_LABELS). */
export const EDITING_LABEL = "Finishing edit…";

function stepJobId(stepDetails: unknown): string | null {
  if (!stepDetails || typeof stepDetails !== "object" || Array.isArray(stepDetails)) return null;
  const v = (stepDetails as { jobId?: unknown }).jobId;
  return typeof v === "string" && v ? v : null;
}

/** `editing` counts as moving only while a compose/regen job is named AND
 *  either no final exists yet or the row was written in the last 2h. */
export function editingIsLive(p: CustomerStageInput, now: number = Date.now()): boolean {
  if (p.status !== "editing") return false;
  if (!stepJobId(p.stepDetails)) return false;
  if (!p.finalVideoUrl) return true;
  const ts = p.updatedAt ? new Date(p.updatedAt).getTime() : Number.NaN;
  return Number.isFinite(ts) && now - ts < EDITING_LIVE_WINDOW_MS;
}

function asInput(
  input: string | null | undefined | CustomerStageInput,
): { p: CustomerStageInput; bare: boolean } {
  if (input && typeof input === "object") return { p: input, bare: false };
  return { p: { status: input }, bare: true };
}

export function customerStage(
  input: string | null | undefined | CustomerStageInput,
): CustomerStage | null {
  const { p, bare } = asInput(input);
  const status = p.status;
  if (!status) return null;
  if (status === "ready") return "done";
  if (QUEUED_STATUSES.has(status as YouTubeProjectStatus)) return "queued";
  if (status === "editing") {
    // Bare status: the legacy optimistic flip (a re-compose was just kicked
    // from this browser). With the row in hand, judge liveness instead.
    if (bare) return "in_progress";
    if (editingIsLive(p)) return "in_progress";
    return p.finalVideoUrl ? "done" : null;
  }
  // A finished stitch with a live final is Done even if a concierge QA
  // write left status as concierge_in_progress (#66, 2026-08-30). Bare
  // status strings stay in_progress — only a row can prove the file exists.
  if (!bare && isStuckBeforeReadyStatus(status) && rowLooksFileReady(p)) {
    return "done";
  }
  if (status === "concierge_in_progress") return "in_progress";
  if (IN_FLIGHT_STATUSES.has(status as YouTubeProjectStatus)) return "in_progress";
  return null;
}

/** Specific phrase on the chip — STATUS_LABELS, never a parallel dictionary. */
export function customerStageDetail(
  input: string | null | undefined | CustomerStageInput,
): string | null {
  const { p, bare } = asInput(input);
  const status = p.status;
  if (!status) return null;
  if (status === "editing") {
    if (bare || editingIsLive(p)) return EDITING_LABEL;
    // Stale edit with a final = Done; the chip prints the stage word alone.
    return p.finalVideoUrl ? STATUS_LABELS.ready : null;
  }
  if (!bare && isStuckBeforeReadyStatus(status) && rowLooksFileReady(p)) {
    return STATUS_LABELS.ready;
  }
  const known = STATUS_LABELS[status as YouTubeProjectStatus];
  if (known) return known;
  return null;
}

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

/**
 * Public counters for videos this account published, straight from
 * `youtube.videos.list?part=statistics`.
 *
 * Deliberately takes the access token as an argument instead of reading it:
 * this module is imported by client components, so it must stay free of
 * prisma / server-only. The route at /api/vater/youtube/stats resolves the
 * user's token (lib/vater/youtube-upload.getAccessToken) and calls this.
 *
 * `videos.list` accepts up to 50 ids per call, so longer lists are chunked.
 * Ids YouTube doesn't return (deleted, private, wrong channel) are simply
 * absent from the map — callers render "—" rather than a zero, because a
 * fabricated 0 views is worse than an honest blank.
 */
export interface YouTubeVideoStats {
  videoId: string;
  views: number | null;
  likes: number | null;
  comments: number | null;
}

const STATS_URL = "https://www.googleapis.com/youtube/v3/videos";
const STATS_CHUNK = 50;

function asCount(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export async function fetchYouTubeStats(
  videoIds: string[],
  accessToken: string,
): Promise<Record<string, YouTubeVideoStats>> {
  const ids = Array.from(
    new Set(videoIds.filter((v): v is string => typeof v === "string" && !!v)),
  );
  const out: Record<string, YouTubeVideoStats> = {};
  if (ids.length === 0 || !accessToken) return out;

  for (let i = 0; i < ids.length; i += STATS_CHUNK) {
    const chunk = ids.slice(i, i + STATS_CHUNK);
    const url = `${STATS_URL}?part=statistics&id=${chunk
      .map(encodeURIComponent)
      .join(",")}&maxResults=${STATS_CHUNK}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(
        `YouTube videos.list ${res.status}: ${text.slice(0, 200)}`,
      );
    }
    const json = (await res.json()) as {
      items?: Array<{
        id?: string;
        statistics?: Record<string, unknown>;
      }>;
    };
    for (const item of json.items ?? []) {
      if (!item.id) continue;
      const s = item.statistics ?? {};
      out[item.id] = {
        videoId: item.id,
        views: asCount(s.viewCount),
        likes: asCount(s.likeCount),
        comments: asCount(s.commentCount),
      };
    }
  }

  return out;
}

/** "12,481" / "—" for a maybe-missing counter. */
export function formatCount(value: number | null | undefined): string {
  return typeof value === "number" ? value.toLocaleString() : "—";
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
