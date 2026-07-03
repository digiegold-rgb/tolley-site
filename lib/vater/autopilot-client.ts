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

export type ReferenceStatusEntry = {
  hasReference: boolean;
  ipaWeight: number | null;
  weightType: string | null;
  endAt: number | null;
};

export type ReferenceStatusMap = Record<string, ReferenceStatusEntry>;

export type PipelineInstance = {
  url: string;
  role: "interactive" | "pipeline";
  healthy: boolean;
  vramFreeGb?: number;
  vramTotalGb?: number;
  comfyVersion?: string;
  queueRunning?: number | null;
  queuePending?: number | null;
};

export type PipelineActiveJob = {
  jobId: string;
  kind: string;
  projectId?: string | null;
  status: string;
  phase: string;
  progress: number;
  updatedAt?: string;
  lastLog?: string | null;
};

export type PipelineStatus = {
  instances: {
    primary?: PipelineInstance;
    vater?: PipelineInstance;
  };
  activeJobs: PipelineActiveJob[];
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

export type ElevenLabsVoice = {
  voice_id: string;
  name: string;
  category?: string;
  description?: string;
  preview_url?: string;
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

/** Video generation backend. "sdxl" = local GPU still images, Veo models = cloud API video clips. */
export type VideoBackend =
  | "sdxl"
  | "veo-3.1-lite"
  | "veo-3.0-fast"
  | "veo-3.1-fast"
  | "veo-3.0"
  | "veo-3.1"
  | "hybrid";

/**
 * TubeGen-parity Style snapshot — sent to DGX inline so the worker has
 * everything it needs (no callback to the portal). Optional; when omitted
 * the worker uses the legacy stylePreset/consistency path.
 *
 * Snapshot semantics: portal serializes the YouTubeStyle row + its
 * characters + customArtStyle at submit time. Editing the Style later
 * never retroactively changes a rendered project.
 */
export type StyleSnapshot = {
  id: string;
  name: string;
  voice: string;
  voiceBackend: "f5-tts" | "elevenlabs";
  voiceSpeed: number;
  voiceStability: number;
  voiceSimilarity: number;
  voiceExaggeration: number;
  language: string;
  defaultWordCount: number;
  scriptMode: string;
  webSearchDefault: boolean;
  additionalContext: string | null;
  referenceTranscripts: Array<{
    videoId?: string;
    url: string;
    title: string;
    wordCount: number;
    transcript: string;
  }>;
  artStylePresetId: string;
  defaultAspectRatio: string;
  defaultQuality: string;
  defaultVisualType: string;
  defaultAnimMode: string;
  defaultAnimMin: number;
  defaultAnimMax: number;
  defaultPacingSec: number | null;
  defaultConsistency: number;
  enableCharts: boolean;
  enableMaps: boolean;
  enableAutoHeaders: boolean;
  overlayTheme: string;
  customArtStyle: {
    id: string;
    name: string;
    description: string;
    referenceImageUrls: string[];
  } | null;
  characters: Array<{
    id: string;
    name: string;
    description: string;
    imageUrl: string | null;
    permanent: boolean;
    placeInEveryImage: boolean;
    gender: string;
  }>;
};

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
  /** Creator model script guidelines — injected as system prompt prefix. */
  scriptGuidelines?: string;
  /** Scene visual consistency 0-100. 0=independent images, 70=recommended.
   *  Maps to img2img denoise strength on the DGX: denoise = 1 - consistency/100. */
  consistency?: number;
  /** Video backend: "sdxl" (default, still images + Ken Burns) or a Veo model
   *  for actual AI video clips. "hybrid" auto-picks Veo for hero scenes. */
  videoBackend?: VideoBackend;
  /** Phase 1+: full Style snapshot. When present, takes precedence over
   *  stylePreset/consistency for fields it sets. Sparse — only keys the
   *  user explicitly set are honored; rest fall through to preset defaults. */
  style?: StyleSnapshot;
  /** User-supplied script. When set, the worker skips principle extraction
   *  and `_generate_script()` and uses this text verbatim for TTS + scene
   *  planning. No min length enforced. */
  scriptOverride?: string;
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

export type ThumbnailInput = {
  jobId: string;
  title: string;
  stylePreset: string;
  sceneImageUrl?: string;
};

export type ThumbnailResult = {
  thumbnailUrl: string;
};

export type SuggestGoalsInput = {
  transcript: string;
  title?: string;
  channel?: string;
};

/**
 * Title-suggest input. Used by the v2 Title step's three modes:
 * - sample: caller passes user's `sampleTitles` to anchor tone.
 * - style:  caller pulls reference transcripts off `styleSnapshot.referenceTranscripts`.
 * - channel-video: caller transcribes via fetchSource first, then re-invokes
 *   sample mode with the transcript-derived sample list.
 *
 * Stateless LLM call on the DGX side. Expected ~5-10s.
 */
export type SuggestTitlesInput = {
  styleSnapshot: StyleSnapshot;
  /** Anchor titles the user pasted (mode=sample) — required there, omitted for style mode. */
  sampleTitles?: string[];
  /** How many titles to return. DGX clamps to [1, 25]; default 5. */
  count?: number;
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

/** Regenerate ONE scene image. Sync — caller shows a spinner. */
export type RegenSceneInput = {
  jobId: string;
  sceneIdx: number;
  imagePrompt: string;
  stylePreset?: string;
  customStylePrompt?: string;
  projectId?: string;
  /** Character roster — when present, primary character's identity descriptor
   *  is prepended server-side so manual regens stay identity-locked. */
  characters?: Array<{
    name: string;
    description: string;
    gender?: string;
  }>;
  /** Image renderer — defaults to "firered-local" for cartoon styles, lets
   *  caller override with sdxl-local / gemini-1k / ideogram-* etc. Whatever
   *  the project was originally generated with should be used here so the
   *  regenerated scene matches the rest of the video. */
  quality?: string;
};

export type RegenSceneResult = {
  jobId: string;
  sceneIdx: number;
  version: number;
  /** Relative URL like `/vater/file/<jobId>/scene/<idx>/<version>` */
  url: string;
  filePath: string;
  prompt: string;
  seed: number;
};

/**
 * Image-to-video animation for ONE scene. Mirrors TubeGen.ai's
 * POST /api/ai/animate-image. Sync — takes ~30-120s (Veo) or 90-300s (LTX).
 */
export type AnimationQuality =
  | "turbo"
  | "default"
  | "default_1080p"
  | "high"
  | "kling-standard"
  | "kling-pro"
  | "kling-master"
  | "luma"
  | "ltx-local"
  | "wan22-local"
  | "modal-wan22"
  | "modal-wan22-fast"
  | "modal-wan22-narrative"
  | "modal-wan22-narrative-fast"
  | "modal-hunyuan-narrative"
  | "modal-hunyuan-narrative-fast"
  | "modal-easyanimate-anime";

/** Wan2.2 sampler preset — picks cfg/shift/denoise/lora. `subtle` damps motion
 * hard for narrative scenes (lady pushing snowball, close-ups, reflective
 * beats). `normal` matches previous behavior. `bold` is reserved for explicit
 * action beats. Honored only by the modal-wan22 / modal-wan22-fast backends. */
export type MotionIntensity = "subtle" | "normal" | "bold";

export type AnimateSceneInput = {
  jobId: string;
  sceneIdx: number;
  /** Free-form motion text, TubeGen-style ("Slowly zoom in on the notebook"). */
  animationPrompt: string;
  /** When true, adds "hold camera still" suffix + sets cameraFixed on Kling. */
  fixedCamera?: boolean;
  /** Quality tier → maps to a specific model + resolution. */
  quality?: AnimationQuality;
  /** Explicit clip length in seconds (4-8). Overrides scene timing. */
  duration?: number;
  /** Scene start/end — server derives duration from these if `duration` omitted. */
  sceneStartS?: number;
  sceneEndS?: number;
  aspectRatio?: "16:9" | "9:16" | "1:1";
  /** Original SDXL prompt — logged for traceability, Veo ignores it. */
  imagePrompt?: string;
  /** Motion preset for Wan2.2 backends — subtle/normal/bold. Default normal. */
  motionIntensity?: MotionIntensity;
  /** FLF2V: reuse the start image as the end-frame so Wan2.2 clamps the
   *  character's ending pose. Massive jitter killer on narrative scenes. */
  holdStartPose?: boolean;
};

export type AnimateSceneResult = {
  jobId: string;
  sceneIdx: number;
  /** 0 for the first animation, 1+ for re-rolls. */
  version: number;
  /** Relative URL like `/vater/file/<jobId>/scene/<idx>/video/<version>` */
  url: string;
  filePath: string;
  durationSeconds: number;
  quality: string;
  model: string;
  backend: "veo" | "ltx" | "kling";
  /** USD cost of this clip. 0 for local LTX. */
  cost: number;
  elapsedSeconds?: number;
  animationPrompt: string;
  fixedCamera: boolean;
  /** Echo of the motion preset that ran — matches what the sampler used. */
  motionIntensity?: MotionIntensity;
  holdStartPose?: boolean;
};

/** Re-compose an existing project with an edited VideoSpec. */
export type ComposeVideoInput = {
  /** The existing pipeline job id — final.mp4 is written into its work dir. */
  jobId: string;
  /** Prisma project id, round-tripped so the async worker knows the row. */
  projectId?: string;
  /** Full VideoSpec (the same shape VaterSlideshow renders). */
  props: unknown;
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
  videoBackend?: VideoBackend;
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
    videoUrl?: string;
    mediaType?: "image" | "video";
  }>;
  finalVideoUrl?: string;
  generationCost?: {
    totalCents: number;
    perScene: number[];
    model: string;
  };
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
  /** Length-agnostic goal suggestions from the DGX `_suggest_goals` step
   *  — each item: {id, title, emoji, subtitle, goalText, preview}. */
  goalSuggestions?: unknown;
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
 *
 * `range` is the value of the client's Range header (e.g. "bytes=0-1023") —
 * forwarded upstream so the DGX returns 206 Partial Content with proper
 * Content-Range / Content-Length headers. Without this the Remotion Player's
 * <video> element can't seek and throws MediaPlaybackError.
 */
async function callRaw(
  method: "GET",
  path: string,
  range?: string | null,
): Promise<Response> {
  assertConfig();
  const url = `${BASE}${path}`;
  const headers: Record<string, string> = { Authorization: `Bearer ${KEY}` };
  if (range) headers.Range = range;
  const res = await fetch(url, {
    method,
    headers,
    cache: "no-store",
  });
  // Accept 200 (full body) AND 206 (range response) — both are non-error.
  if (!res.ok && res.status !== 206) {
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

  /** Cooperatively cancel a running job. The worker checks the cancel flag
   *  at each pipeline stage boundary and bails cleanly. Status ends as
   *  "cancelled" (not "failed"). */
  cancelJob: (input: { jobId: string }) =>
    call<{ ok: boolean; jobId: string; wasRunning: boolean }>(
      "POST",
      "/vater/cancel-job",
      input,
    ),

  /** Async — TTS only via F5-TTS through ComfyUI. */
  tts: (input: TtsInput) =>
    call<{ jobId: string }>("POST", "/vater/tts", input),

  /** Async — generate per-scene SDXL imagery. */
  generateScenes: (input: GenerateScenesInput) =>
    call<{ jobId: string }>("POST", "/vater/generate-scenes", input),

  /** Sync — regenerate ONE scene image for the editor. ~15-30s per call. */
  regenScene: (input: RegenSceneInput) =>
    call<RegenSceneResult>("POST", "/vater/regen-scene", input),

  /** Async — kick off animate-scene and get an animateJobId back. Poll
   *  `getJob(animateJobId)` until status === "done" / "failed". The long
   *  i2v call (30-300s) exceeds CF's 100s tunnel timeout, so this had to
   *  become async — see `_animate_scene_worker` on the DGX side. */
  animateScene: (input: AnimateSceneInput) =>
    call<{ animateJobId: string; jobId: string; sceneIdx: number }>(
      "POST",
      "/vater/animate-scene",
      input,
    ),

  /** Async — animate ALL scenes of a project in one warm Modal container.
   *  Cheaper than N separate animateScene calls (model loads once, not N times).
   *  Returns animateAllJobId; poll getJob() until done. */
  animateAllScenes: (input: {
    jobId: string;
    scenes: Array<{
      sceneIdx: number;
      animationPrompt?: string;
      beatText?: string;
      fixedCamera?: boolean;
      motionIntensity?: MotionIntensity;
      holdStartPose?: boolean;
    }>;
    quality:
      | "modal-wan22"
      | "modal-wan22-fast"
      | "modal-wan22-narrative"
      | "modal-wan22-narrative-fast"
      | "modal-hunyuan-narrative"
      | "modal-hunyuan-narrative-fast";
    aspectRatio?: string;
  }) =>
    call<{ animateAllJobId: string; jobId: string; sceneCount: number }>(
      "POST",
      "/vater/animate-all-scenes",
      input,
    ),

  /** Sync — LLM suggests an animationPrompt + fixedCamera for ONE scene
   *  based on its image prompt + beat text. ~1-3s per call. */
  planSceneAnimation: (input: {
    jobId: string;
    sceneIdx: number;
    imagePrompt?: string;
    beatText?: string;
  }) =>
    call<{
      sceneIdx: number;
      animationPrompt: string;
      fixedCamera: boolean;
    }>("POST", "/vater/plan-scene-animation", input),

  /** Async — re-compose the final MP4 from an edited VideoSpec. Returns a jobId. */
  composeVideo: (input: ComposeVideoInput) =>
    call<{ jobId: string }>("POST", "/vater/compose-video", input),

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

  /** Live pipeline snapshot — both ComfyUI instances + active Vater jobs. */
  getPipelineStatus: () =>
    call<PipelineStatus>("GET", "/vater/pipeline-status"),

  /** Per-preset reference-image status from the shared reference library. */
  getReferenceStatus: async (): Promise<ReferenceStatusMap> => {
    const data = await call<{
      root?: string;
      references?: Record<string, ReferenceStatusEntry>;
    }>("GET", "/vater/reference-status");
    return data?.references ?? {};
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

  /** List ElevenLabs voices on the authenticated account. Returns `{voices, error?}`
   * — empty voices + error string when the key is missing or the upstream call failed. */
  getElevenLabsVoices: async (): Promise<{
    voices: ElevenLabsVoice[];
    error?: string;
  }> => {
    const data = await call<{
      voices?: ElevenLabsVoice[];
      error?: string;
    }>("GET", "/vater/voices/elevenlabs");
    return {
      voices: Array.isArray(data?.voices) ? data.voices : [],
      error: typeof data?.error === "string" ? data.error : undefined,
    };
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
  fetchFile: (jobId: string, kind: string, range?: string | null) =>
    callRaw(
      "GET",
      `/vater/file/${encodeURIComponent(jobId)}/${kind}`,
      range,
    ),

  /** Stream a voice clone reference WAV back through the proxy. */
  fetchVoiceFile: (name: string, range?: string | null) =>
    callRaw(
      "GET",
      `/vater/file/voice/${encodeURIComponent(name)}`,
      range,
    ),

  /** Generate a YouTube thumbnail (1280×720 SDXL + ffmpeg text overlay). */
  generateThumbnail: (input: ThumbnailInput) =>
    call<ThumbnailResult>("POST", "/vater/thumbnail", input),

  /** Re-run goal suggestions for a transcript (stateless LLM call, ~10-15s). */
  suggestGoals: (input: SuggestGoalsInput) =>
    call<{ suggestions: unknown[] }>("POST", "/vater/suggest-goals", input),

  suggestTitles: (input: SuggestTitlesInput) =>
    call<{ titles: string[] }>("POST", "/vater/suggest-titles", input),
};

export type AutopilotClient = typeof autopilot;
