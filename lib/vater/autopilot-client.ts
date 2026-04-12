/**
 * Typed fetch wrapper for the Content Autopilot `/vater/*` endpoints on the
 * DGX. Single source of bearer auth + error handling for the entire vater
 * youtube pipeline. NEVER swallow errors silently — `AutopilotError` bubbles
 * up so the caller (poll route, RSS cron, etc) can surface a real message.
 *
 * Per `feedback_silent_failures_leads.md`, the leads/vater path must surface
 * every fetch error.
 */
import "server-only";

const BASE = (process.env.AUTOPILOT_URL || "").replace(/\/$/, "");
const KEY = process.env.CONTENT_API_KEY || "";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type JobPhase =
  // fetch-source phases
  | "downloading"
  | "transcribing"
  // run-creation phases
  | "extracting_principles"
  | "scripting"
  | "verifying"
  | "tts"
  | "generating_audio"
  | "aligning"
  | "aligning_captions"
  | "prompting"
  | "generating_scenes"
  | "composing"
  | "rendering"
  | "composing_video"
  // terminal
  | "done"
  | "failed"
  | string;

export type JobStatus = {
  status: "pending" | "running" | "done" | "failed";
  phase: JobPhase;
  progress: number;
  result?: unknown;
  error?: string;
  /** Rolling log buffer (up to 30 lines, HH:MM:SS-prefixed, server-appended). */
  logs?: string[];
  updatedAt?: string;
};

export type StylePreset = {
  id: string;
  name: string;
  prompt: string;
};

export type VoiceClone = {
  name: string;
  sampleText?: string;
  language: string;
};

export type FeedSampleItem = {
  guid: string;
  title: string;
  url: string;
  publishedAt?: string;
  description?: string;
};

export type FeedProbeResult = {
  feedType: "youtube" | "podcast" | "blog" | "social";
  title: string;
  sample: FeedSampleItem[];
};

export type VerifyCoverageEntry = {
  principle_index: number;
  present: boolean;
  fidelity: "high" | "medium" | "low";
  note?: string;
};

export type VerifyResult = {
  ok: boolean;
  coverage: VerifyCoverageEntry[];
  fabrications: string[];
  summary: string;
};

export type CreationMode = "transcribe" | "topic";

export type RunCreationInput = {
  projectId: string;
  mode: CreationMode;
  transcript?: string;
  topic?: string;
  goal: string;
  targetWordCount: number;
  stylePreset: string;
  voiceCloneName: string;
  customStylePrompt?: string;
  /** Optional catalog id from `/vater/music-catalog` (CC-BY-4.0). */
  backgroundMusicId?: string;
  /** 0.0-1.0, default 0.18 in the worker if omitted. */
  musicVolume?: number;
};

/**
 * Music track from `/vater/music-catalog`. CC-BY-4.0 Kevin MacLeod library.
 */
export type MusicTrack = {
  id: string;
  name: string;
  filename: string;
  mood?: string[];
  bpm?: number;
  duration?: number;
  source?: string;
  source_url?: string;
  license?: string;
  attribution?: string;
};

/**
 * SFX entry from `/vater/sfx-catalog`. CC0 procedural WAVs. v2 will wire
 * per-scene injection — for now the catalog is just exposed for UI pickers.
 */
export type SfxClip = {
  id: string;
  name: string;
  filename: string;
  tags?: string[];
  duration?: number;
  source?: string;
  license?: string;
};

export type FetchSourceInput = {
  projectId?: string;
  sourceUrl: string;
};

export type TtsInput = {
  script: string;
  voiceCloneName: string;
};

export type GenerateScenesInput = {
  script: string;
  stylePreset: string;
  sceneCount: number;
};

export type VerifyScriptInput = {
  script: string;
  principles: unknown;
};

export type FeedProbeInput = {
  url: string;
};

/**
 * Final shape of `JobStatus.result` once `/vater/run-creation` finishes.
 * Mirrors `_run_creation_worker` in vater.py.
 */
export type RunCreationResult = {
  sourcePrinciples?: unknown;
  script?: string;
  scriptMeta?: { wordCount?: number; targetWordCount?: number };
  verifiedScript?: boolean;
  verificationReport?: unknown;
  audioUrl?: string;
  audioDuration?: number;
  captionTimings?: Array<{ word: string; start: number; end: number }>;
  scenesJson?: Array<{
    idx: number;
    beatText?: string;
    startS?: number;
    endS?: number;
    imagePrompt?: string;
    imageUrl?: string;
  }>;
  finalVideoUrl?: string;
};

/**
 * Final shape of `JobStatus.result` once `/vater/fetch-source` finishes.
 */
export type FetchSourceResult = {
  transcript?: string;
  segments?: unknown;
  duration?: number;
  title?: string;
  channel?: string;
  language?: string;
  wordCount?: number;
};

// ---------------------------------------------------------------------------
// Error
// ---------------------------------------------------------------------------

export class AutopilotError extends Error {
  status: number;
  endpoint: string;
  body: string;

  constructor(status: number, endpoint: string, body: string) {
    super(`[autopilot ${status}] ${endpoint}: ${body || "(empty body)"}`);
    this.name = "AutopilotError";
    this.status = status;
    this.endpoint = endpoint;
    this.body = body;
  }
}

export class AutopilotConfigError extends Error {
  constructor(missing: string) {
    super(
      `[autopilot config] missing env var: ${missing}. Set AUTOPILOT_URL and CONTENT_API_KEY in Vercel env.`,
    );
    this.name = "AutopilotConfigError";
  }
}

// ---------------------------------------------------------------------------
// Core fetch wrapper
// ---------------------------------------------------------------------------

function assertConfig() {
  if (!BASE) throw new AutopilotConfigError("AUTOPILOT_URL");
  if (!KEY) throw new AutopilotConfigError("CONTENT_API_KEY");
}

async function call<T>(
  method: "GET" | "POST" | "DELETE",
  path: string,
  body?: unknown,
): Promise<T> {
  assertConfig();
  const url = `${BASE}${path}`;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${KEY}`,
  };
  if (body !== undefined) headers["Content-Type"] = "application/json";

  const res = await fetch(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new AutopilotError(res.status, path, text || res.statusText);
  }

  // Some endpoints (file streams) shouldn't be JSON-parsed — those use
  // `callRaw` below. This helper assumes JSON.
  return (await res.json()) as T;
}

/**
 * Raw response passthrough for binary file endpoints
 * (`/vater/file/{jobId}/{kind}` etc). Returns the live `Response` object so
 * the caller can stream it back to the browser.
 */
async function callRaw(method: "GET", path: string): Promise<Response> {
  assertConfig();
  const url = `${BASE}${path}`;
  const res = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${KEY}` },
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new AutopilotError(res.status, path, text || res.statusText);
  }
  return res;
}

/**
 * multipart/form-data POST helper for endpoints like `/vater/voices`.
 */
async function callForm<T>(
  path: string,
  form: FormData,
): Promise<T> {
  assertConfig();
  const url = `${BASE}${path}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${KEY}` },
    body: form,
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new AutopilotError(res.status, path, text || res.statusText);
  }
  return (await res.json()) as T;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export const autopilot = {
  /** Async — `yt-dlp` + transcribe a source URL. Returns a jobId. */
  fetchSource: (input: FetchSourceInput) =>
    call<{ jobId: string }>("POST", "/vater/fetch-source", input),

  /** Async — full creation pipeline (extract → script → verify → tts → align → scenes → compose). */
  runCreation: (input: RunCreationInput) =>
    call<{ jobId: string }>("POST", "/vater/run-creation", input),

  /** Async — TTS only via F5-TTS through ComfyUI. */
  tts: (input: TtsInput) =>
    call<{ jobId: string }>("POST", "/vater/tts", input),

  /** Async — generate per-scene SDXL imagery. */
  generateScenes: (input: GenerateScenesInput) =>
    call<{ jobId: string }>("POST", "/vater/generate-scenes", input),

  /** Sync — verify a script against extracted principles. */
  verifyScript: (input: VerifyScriptInput) =>
    call<VerifyResult>("POST", "/vater/verify-script", input),

  /** Sync — probe an RSS feed URL. */
  feedProbe: (input: FeedProbeInput) =>
    call<FeedProbeResult>("POST", "/vater/feed/probe", input),

  /** Poll a previously-submitted async job. */
  getJob: (jobId: string) =>
    call<JobStatus>("GET", `/vater/jobs/${encodeURIComponent(jobId)}`),

  /** List the 8 style presets. (DGX returns `{styles: [...]}`, unwrap.) */
  getStyles: async (): Promise<StylePreset[]> => {
    const data = await call<{ styles?: StylePreset[] } | StylePreset[]>(
      "GET",
      "/vater/styles",
    );
    if (Array.isArray(data)) return data;
    return Array.isArray(data?.styles) ? data.styles : [];
  },

  /** List voice clones. (DGX returns `{voices: [...]}`, unwrap.) */
  getVoices: async (): Promise<VoiceClone[]> => {
    const data = await call<{ voices?: VoiceClone[] } | VoiceClone[]>(
      "GET",
      "/vater/voices",
    );
    if (Array.isArray(data)) return data;
    return Array.isArray(data?.voices) ? data.voices : [];
  },

  /** Background-music catalog (CC-BY-4.0 Kevin MacLeod). */
  fetchMusicCatalog: async (): Promise<MusicTrack[]> => {
    const data = await call<{ tracks?: MusicTrack[] } | MusicTrack[]>(
      "GET",
      "/vater/music-catalog",
    );
    if (Array.isArray(data)) return data;
    return Array.isArray(data?.tracks) ? data.tracks : [];
  },

  /** SFX catalog (CC0 procedural WAVs). */
  fetchSfxCatalog: async (): Promise<SfxClip[]> => {
    const data = await call<{ sfx?: SfxClip[] } | SfxClip[]>(
      "GET",
      "/vater/sfx-catalog",
    );
    if (Array.isArray(data)) return data;
    return Array.isArray(data?.sfx) ? data.sfx : [];
  },

  /** Upload a new voice clone (multipart: audio file + name + sampleText). */
  uploadVoice: (form: FormData) =>
    callForm<{ name: string }>("/vater/voices", form),

  /** Stream a finished asset back through the proxy: kind = "audio" | "video" | `scene/${idx}`. */
  fetchFile: (jobId: string, kind: string) =>
    callRaw("GET", `/vater/file/${encodeURIComponent(jobId)}/${kind}`),

  /** Stream a voice clone reference WAV back through the proxy. */
  fetchVoiceFile: (name: string) =>
    callRaw("GET", `/vater/file/voice/${encodeURIComponent(name)}`),
};

export type AutopilotClient = typeof autopilot;
