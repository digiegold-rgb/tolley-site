/**
 * Cinema lane — Seedance 2.0 reference-to-video (estate-lady path).
 *
 * This is NOT Wan Motion 2. Proof-estate-01 was Spark cinema on
 * bytedance/seedance-2.0/reference-to-video (~8 clips × 8–10s, native audio).
 * Kling 3 Pro elements is the face/partner-filter fallback.
 *
 * Parent recipe fal-cinema. Child clips fal-seedance-ref / fal-kling-elements.
 * Stitch reuses fal-wan-stitch concat-copy. ArcFace/Gemini QA stays on Spark.
 */

import {
  BEAT_STATUSES,
  STITCH_RECIPE,
  isBeatStatus,
  type BeatStatus,
} from "./generate-beats";
import {
  DEFAULT_MOTION_NEGATIVE,
  MOTION_RESOLUTION_DEFAULT,
  type MotionResolution,
} from "./generate-motion-card";
import {
  ESTATE_PROOF_BEATS,
  ESTATE_PROOF_TITLE,
  type EstateProofBeat,
} from "./generate-cinema-estate";
export type { EstateProofBeat };
import { needsSpendConfirm, SPEND_CONFIRM_USD } from "./generate-queue-binding";

export const CINEMA_RECIPE = "fal-cinema" as const;
export const CINEMA_CHILD_SEEDANCE = "fal-seedance-ref" as const;
export const CINEMA_CHILD_KLING = "fal-kling-elements" as const;
export { STITCH_RECIPE };

export const CINEMA_SECONDS_MIN = 4;
export const CINEMA_SECONDS_MAX = 15;
export const CINEMA_SECONDS_DEFAULT = 10;
export const KLING_SECONDS_MIN = 3;
export const CINEMA_SECONDS_CHIPS_KLING = [3, 4, 5, 8, 10, 12, 15] as const;
export const CINEMA_SECONDS_CHIPS_SEEDANCE = [4, 5, 8, 10, 12, 15] as const;
export const CINEMA_IMAGE_MAX = 9;

export const SEEDANCE_USD_PER_SEC_720P = 0.3;
export const KLING_USD_PER_SEC_LOW = 0.112;
export const KLING_USD_PER_SEC_HIGH = 0.168;

export const CINEMA_MODELS = ["seedance", "kling"] as const;
export type CinemaModel = (typeof CINEMA_MODELS)[number];

export function isCinemaRecipe(recipe: string | null | undefined): boolean {
  return recipe === CINEMA_RECIPE;
}

export function isCinemaChildRecipe(recipe: string | null | undefined): boolean {
  return recipe === CINEMA_CHILD_SEEDANCE || recipe === CINEMA_CHILD_KLING;
}

export function cinemaSecondsRange(model?: CinemaModel): { min: number; max: number } {
  if (model === "kling") return { min: KLING_SECONDS_MIN, max: CINEMA_SECONDS_MAX };
  return { min: CINEMA_SECONDS_MIN, max: CINEMA_SECONDS_MAX };
}

export function cinemaSecondsChips(model?: CinemaModel): readonly number[] {
  return model === "kling" ? CINEMA_SECONDS_CHIPS_KLING : CINEMA_SECONDS_CHIPS_SEEDANCE;
}

export function clampCinemaSeconds(
  value: unknown,
  fallback = CINEMA_SECONDS_DEFAULT,
  model?: CinemaModel,
): number {
  const { min, max } = cinemaSecondsRange(model);
  const n = Number(value);
  const raw = Number.isFinite(n) ? n : Number(fallback);
  const picked = Number.isFinite(raw) ? raw : CINEMA_SECONDS_DEFAULT;
  return Math.min(max, Math.max(min, Math.round(picked)));
}

export function cinemaUsdEstimate(
  seconds: number,
  model: CinemaModel = "seedance",
): { usd: number; usdHigh?: number; rateLabel: string } {
  const s = Math.max(0, Number(seconds) || 0);
  if (model === "kling") {
    const low = Math.round(s * KLING_USD_PER_SEC_LOW * 100) / 100;
    const high = Math.round(s * KLING_USD_PER_SEC_HIGH * 100) / 100;
    return { usd: low, usdHigh: high, rateLabel: `~$${KLING_USD_PER_SEC_LOW}–${KLING_USD_PER_SEC_HIGH}/s Kling` };
  }
  const usd = Math.round(s * SEEDANCE_USD_PER_SEC_720P * 100) / 100;
  return { usd, rateLabel: `~$${SEEDANCE_USD_PER_SEC_720P}/s Seedance @720p` };
}

export type CinemaBeat = {
  id: string;
  status: BeatStatus;
  prompt: string;
  vo_line: string;
  negative_prompt: string;
  seconds: number;
  generate_audio: boolean;
  video_ref_url: string;
  job_id: string;
  error: string;
};

export type CinemaQueue = {
  recipe: typeof CINEMA_RECIPE;
  title: string;
  script: string;
  image_urls: string[];
  audio_url: string;
  prior_video_url: string;
  aspect: "9:16";
  resolution: MotionResolution;
  model: CinemaModel;
  generate_audio: boolean;
  pass_prev_video: boolean;
  auto_advance: boolean;
  beats: CinemaBeat[];
  stitch_job_id: string;
  stitch_error: string;
};

export type CinemaEstimate = {
  beat_count: number;
  fal_calls: number;
  planned_seconds: number;
  usd: number;
  usd_high?: number;
  model: CinemaModel;
  needs_confirm: boolean;
  note: string;
};

export function parseHttpsUrlList(raw: unknown, max = CINEMA_IMAGE_MAX): string[] {
  const list = Array.isArray(raw)
    ? raw
    : typeof raw === "string"
      ? raw.split(/\n|,/).map((s) => s.trim())
      : [];
  const out: string[] = [];
  for (const item of list) {
    const u = String(item || "").trim();
    if (!u) continue;
    if (!/^https:\/\//i.test(u) && !/^\/api\/generate\/jobs\/[^/]+\/(image|media)\?/.test(u)) continue;
    out.push(u);
    if (out.length >= max) break;
  }
  return out;
}

/** Narrow unknown JSON (or a pasted newline list) to `string[] | undefined`. */
export function parseOptionalStringList(raw: unknown): string[] | undefined {
  if (raw == null) return undefined;
  if (typeof raw === "string") return parseHttpsUrlList(raw);
  if (Array.isArray(raw) && raw.every((item): item is string => typeof item === "string")) {
    return raw;
  }
  return undefined;
}

export function newCinemaBeatId(): string {
  return `cn_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function emptyCinemaBeat(partial?: Partial<CinemaBeat>, model?: CinemaModel): CinemaBeat {
  return {
    id: partial?.id || newCinemaBeatId(),
    status: isBeatStatus(partial?.status) ? partial.status : "draft",
    prompt: typeof partial?.prompt === "string" ? partial.prompt : "",
    vo_line: typeof partial?.vo_line === "string" ? partial.vo_line : "",
    negative_prompt: partial?.negative_prompt ?? DEFAULT_MOTION_NEGATIVE,
    seconds: clampCinemaSeconds(partial?.seconds, CINEMA_SECONDS_DEFAULT, model),
    generate_audio: partial?.generate_audio !== false,
    video_ref_url: (partial?.video_ref_url || "").trim(),
    job_id: (partial?.job_id || "").trim(),
    error: (partial?.error || "").trim(),
  };
}

export function emptyCinemaQueue(partial?: Partial<CinemaQueue>): CinemaQueue {
  const urls = parseHttpsUrlList(partial?.image_urls);
  const model: CinemaModel = (CINEMA_MODELS as readonly string[]).includes(String(partial?.model))
    ? (partial!.model as CinemaModel)
    : "seedance";
  return {
    recipe: CINEMA_RECIPE,
    title: (partial?.title || "").trim() || "Cinema take",
    script: typeof partial?.script === "string" ? partial.script : "",
    image_urls: urls,
    audio_url: (partial?.audio_url || "").trim(),
    prior_video_url: (partial?.prior_video_url || "").trim(),
    aspect: "9:16",
    resolution:
      partial?.resolution === "480p" || partial?.resolution === "1080p"
        ? partial.resolution
        : MOTION_RESOLUTION_DEFAULT,
    model,
    generate_audio: partial?.generate_audio !== false,
    pass_prev_video: partial?.pass_prev_video !== false,
    auto_advance: partial?.auto_advance !== false,
    beats: Array.isArray(partial?.beats) ? partial.beats.map((b) => emptyCinemaBeat(b, model)) : [],
    stitch_job_id: (partial?.stitch_job_id || "").trim(),
    stitch_error: (partial?.stitch_error || "").trim(),
  };
}

function asRecord(raw: unknown): Record<string, unknown> {
  return raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
}

export function parseCinemaBeat(raw: unknown, model?: CinemaModel): CinemaBeat {
  const rec = asRecord(raw);
  const beat = emptyCinemaBeat({
    id: typeof rec.id === "string" ? rec.id : undefined,
    status: isBeatStatus(rec.status) ? rec.status : "draft",
    prompt: typeof rec.prompt === "string" ? rec.prompt : undefined,
    vo_line:
      typeof rec.vo_line === "string"
        ? rec.vo_line
        : typeof rec.vo === "string"
          ? rec.vo
          : undefined,
    negative_prompt: typeof rec.negative_prompt === "string" ? rec.negative_prompt : undefined,
    seconds: rec.seconds as number | undefined,
    generate_audio: rec.generate_audio !== false,
    video_ref_url:
      typeof rec.video_ref_url === "string"
        ? rec.video_ref_url
        : typeof rec.videoRefUrl === "string"
          ? rec.videoRefUrl
          : undefined,
    job_id: typeof rec.job_id === "string" ? rec.job_id : typeof rec.jobId === "string" ? rec.jobId : undefined,
    error: typeof rec.error === "string" ? rec.error : undefined,
  });
  if (!beat.id) throw new Error("Cinema beat needs an id");
  return beat;
}

export function parseCinemaQueue(raw: unknown): CinemaQueue {
  const rec = asRecord(raw);
  const beatsRaw = Array.isArray(rec.beats) ? rec.beats : [];
  const model = (CINEMA_MODELS as readonly string[]).includes(String(rec.model))
    ? (rec.model as CinemaModel)
    : undefined;
  return emptyCinemaQueue({
    title: typeof rec.title === "string" ? rec.title : undefined,
    script: typeof rec.script === "string" ? rec.script : undefined,
    image_urls: parseOptionalStringList(rec.image_urls ?? rec.imageUrls),
    audio_url: typeof rec.audio_url === "string" ? rec.audio_url : typeof rec.audioUrl === "string" ? rec.audioUrl : undefined,
    prior_video_url:
      typeof rec.prior_video_url === "string"
        ? rec.prior_video_url
        : typeof rec.priorVideoUrl === "string"
          ? rec.priorVideoUrl
          : undefined,
    resolution: rec.resolution as MotionResolution | undefined,
    model,
    generate_audio: rec.generate_audio !== false,
    pass_prev_video: rec.pass_prev_video !== false,
    auto_advance: rec.auto_advance !== false,
    beats: beatsRaw.map((b) => parseCinemaBeat(b, model)),
    stitch_job_id:
      typeof rec.stitch_job_id === "string"
        ? rec.stitch_job_id
        : typeof rec.stitchJobId === "string"
          ? rec.stitchJobId
          : undefined,
    stitch_error: typeof rec.stitch_error === "string" ? rec.stitch_error : undefined,
  });
}

export function parseScriptLines(script: string): string[] {
  return (script || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"));
}

export function parseCinemaShotlistJson(raw: unknown): {
  title?: string;
  image_urls?: string[];
  audio_url?: string;
  prior_video_url?: string;
  model?: CinemaModel;
  beats: Array<{ id?: string; seconds?: number; vo?: string; vo_line?: string; prompt?: string }>;
} | null {
  const rec = asRecord(raw);
  const beats = Array.isArray(rec.beats) ? rec.beats : [];
  if (!beats.length) return null;
  return {
    title: typeof rec.title === "string" ? rec.title : undefined,
    image_urls: parseHttpsUrlList(rec.image_urls ?? rec.imageUrls ?? rec.refs),
    audio_url: typeof rec.audio_url === "string" ? rec.audio_url : undefined,
    prior_video_url: typeof rec.prior_video_url === "string" ? rec.prior_video_url : undefined,
    model: (CINEMA_MODELS as readonly string[]).includes(String(rec.model))
      ? (rec.model as CinemaModel)
      : undefined,
    beats: beats.map((b) => {
      const row = asRecord(b);
      return {
        id: typeof row.id === "string" ? row.id : undefined,
        seconds: Number(row.seconds),
        vo: typeof row.vo === "string" ? row.vo : undefined,
        vo_line: typeof row.vo_line === "string" ? row.vo_line : undefined,
        prompt: typeof row.prompt === "string" ? row.prompt : undefined,
      };
    }),
  };
}

export function cinemaPromptScaffold(vo: string, seconds: number, model?: CinemaModel): string {
  const line = vo.trim();
  const s = clampCinemaSeconds(seconds, CINEMA_SECONDS_DEFAULT, model);
  const mid = Math.max(3, Math.min(s - 2, Math.round(s * 0.4)));
  return [
    `Shot 1 (0-${mid}s): @Image1 the same adult woman, full body, photoreal, 9:16. Soft natural motion.`,
    `Shot 2 (${mid}-${s}s): closer on @Image2 / @Image3 identity. Camera holds.`,
    line ? `She says exactly: "${line}"` : "",
    `@Audio1`,
  ]
    .filter(Boolean)
    .join(" ");
}

export function estateProofBeats(): EstateProofBeat[] {
  return ESTATE_PROOF_BEATS.map((b) => ({
    id: b.id,
    seconds: clampCinemaSeconds(b.seconds, CINEMA_SECONDS_DEFAULT, "seedance"),
    vo: b.vo,
    prompt: b.prompt || cinemaPromptScaffold(b.vo, b.seconds, "seedance"),
  }));
}

export function planCinemaQueue(opts: {
  script?: string;
  shotlist?: unknown;
  imageUrls?: string[];
  audioUrl?: string;
  priorVideoUrl?: string;
  model?: CinemaModel;
  generateAudio?: boolean;
  passPrevVideo?: boolean;
  title?: string;
  fallbackPrompt?: string;
}): CinemaQueue {
  const imported = opts.shotlist ? parseCinemaShotlistJson(opts.shotlist) : null;
  const model = opts.model || imported?.model;
  const lines = parseScriptLines(opts.script || "");
  const fromImport = imported?.beats.length
    ? imported.beats.map((b) => {
        const vo = (b.vo_line || b.vo || "").trim();
        return emptyCinemaBeat({
          id: b.id,
          vo_line: vo,
          seconds: b.seconds,
          prompt: (b.prompt || "").trim() || cinemaPromptScaffold(vo, b.seconds || CINEMA_SECONDS_DEFAULT, model),
          generate_audio: opts.generateAudio !== false,
        }, model);
      })
    : lines.map((line) => {
        const looksVo = line.length < 180 && !/^shot\s+\d/i.test(line);
        const vo = looksVo ? line.replace(/^she says exactly:\s*/i, "").replace(/^["“]|["”]$/g, "") : "";
        return emptyCinemaBeat({
          vo_line: vo,
          prompt: looksVo ? cinemaPromptScaffold(vo, CINEMA_SECONDS_DEFAULT, model) : line,
          generate_audio: opts.generateAudio !== false,
        }, model);
      });
  const beats = fromImport.length
    ? fromImport
    : [
        emptyCinemaBeat({
          prompt: (opts.fallbackPrompt || "").trim() || cinemaPromptScaffold("", CINEMA_SECONDS_DEFAULT, model),
          generate_audio: opts.generateAudio !== false,
        }, model),
      ];
  return emptyCinemaQueue({
    title: opts.title || imported?.title,
    script: opts.script || beats.map((b) => b.vo_line || b.prompt).join("\n"),
    image_urls: opts.imageUrls?.length ? opts.imageUrls : imported?.image_urls,
    audio_url: opts.audioUrl || imported?.audio_url,
    prior_video_url: opts.priorVideoUrl || imported?.prior_video_url,
    model: opts.model || imported?.model,
    generate_audio: opts.generateAudio !== false,
    pass_prev_video: opts.passPrevVideo !== false,
    beats,
  });
}

export function loadEstateProofTemplate(opts?: {
  imageUrls?: string[];
  audioUrl?: string;
  priorVideoUrl?: string;
}): CinemaQueue {
  return planCinemaQueue({
    shotlist: { title: ESTATE_PROOF_TITLE, beats: ESTATE_PROOF_BEATS },
    imageUrls: opts?.imageUrls,
    audioUrl: opts?.audioUrl,
    priorVideoUrl: opts?.priorVideoUrl,
    title: ESTATE_PROOF_TITLE,
    model: "seedance",
    generateAudio: true,
    passPrevVideo: true,
  });
}

export function estimateCinema(queue: Pick<CinemaQueue, "beats" | "model">): CinemaEstimate {
  const remaining = queue.beats.filter((b) => b.status === "draft" || (b.status === "rejected" && !b.error.trim()));
  const planned = remaining.reduce((s, b) => s + b.seconds, 0);
  const priced = cinemaUsdEstimate(planned, queue.model);
  const note =
    queue.model === "kling"
      ? `${remaining.length} Kling 3 Pro I2V calls × remaining drafts ≈ ${planned}s ` +
        `(~$${priced.usd.toFixed(2)}–$${(priced.usdHigh || priced.usd).toFixed(2)} @720p). ` +
        `Fallback when Seedance partner/face filter blocks refs.`
      : `${remaining.length} Seedance 2.0 reference-to-video calls × remaining drafts ≈ ${planned}s ` +
        `(~$${priced.usd.toFixed(2)} @720p, ~$${SEEDANCE_USD_PER_SEC_720P}/s). ` +
        `Wan Motion 2 cannot match this path.`;
  return {
    beat_count: queue.beats.length,
    fal_calls: remaining.length,
    planned_seconds: planned,
    usd: priced.usd,
    usd_high: priced.usdHigh,
    model: queue.model,
    needs_confirm: needsSpendConfirm(priced.usdHigh ?? priced.usd, SPEND_CONFIRM_USD),
    note,
  };
}

export function findCinemaBeat(queue: CinemaQueue, beatId: string): CinemaBeat | null {
  return queue.beats.find((b) => b.id === beatId) || null;
}

export function cinemaBeatByJobId(queue: CinemaQueue, jobId: string): CinemaBeat | null {
  return queue.beats.find((b) => b.job_id && b.job_id === jobId) || null;
}

export function patchCinemaBeat(
  queue: CinemaQueue,
  beatId: string,
  patch: Partial<CinemaBeat>,
): CinemaQueue {
  const idx = queue.beats.findIndex((b) => b.id === beatId);
  if (idx < 0) throw new Error("Cinema beat not found");
  const beats = queue.beats.slice();
  beats[idx] = emptyCinemaBeat({ ...beats[idx], ...patch, id: beats[idx].id }, queue.model);
  return { ...queue, beats };
}

export function withCinemaModel(queue: CinemaQueue, model: CinemaModel): CinemaQueue {
  return {
    ...queue,
    model,
    beats: queue.beats.map((b) => ({
      ...b,
      seconds: clampCinemaSeconds(b.seconds, CINEMA_SECONDS_DEFAULT, model),
    })),
  };
}

export function applyLocalCinemaBeatPatch(
  queue: CinemaQueue,
  beatId: string,
  patch: Partial<CinemaBeat>,
): CinemaQueue {
  const idx = queue.beats.findIndex((b) => b.id === beatId);
  if (idx < 0) throw new Error("Cinema beat not found");
  const beats = queue.beats.slice();
  const next = { ...beats[idx], ...patch, id: beats[idx].id };
  if (patch.seconds !== undefined) {
    next.seconds = clampCinemaSeconds(patch.seconds, CINEMA_SECONDS_DEFAULT, queue.model);
  }
  beats[idx] = next;
  return { ...queue, beats };
}

export function markCinemaBeatGenerating(queue: CinemaQueue, beatId: string, jobId: string): CinemaQueue {
  return patchCinemaBeat(queue, beatId, { status: "generating", job_id: jobId, error: "" });
}

export function isInFlightJobStatus(status: string | null | undefined): boolean {
  return status === "running" || status === "queued";
}

export function isFalPartnerOrPolicyError(error: string | null | undefined): boolean {
  const t = (error || "").toLowerCase();
  return (
    t.includes("content_policy") ||
    t.includes("content policy") ||
    t.includes("content checker") ||
    t.includes("partner") ||
    (t.includes("face") && t.includes("filter")) ||
    (t.includes("422") && (t.includes("flagged") || t.includes("policy") || t.includes("safety")))
  );
}

export function formatCinemaFalError(error: string | null | undefined): string {
  const raw = (error || "generation failed").trim() || "generation failed";
  if (!isFalPartnerOrPolicyError(raw)) return raw.slice(0, 500);
  if (/kling fallback/i.test(raw)) return raw.slice(0, 500);
  return `Seedance partner/face filter — clip not delivered. Switch the model to Kling 3 Pro elements and retry. ${raw}`.slice(
    0,
    500,
  );
}

export function failedHoldCinemaBeats(queue: CinemaQueue): CinemaBeat[] {
  return queue.beats.filter((b) => b.status === "rejected" && Boolean(b.error.trim()));
}

export function cinemaGenerateLocked(
  queue: CinemaQueue,
  children?: Array<{ id: string; status: string }> | null,
): boolean {
  return inFlightCinemaBeats(queue, children).length > 0 || failedHoldCinemaBeats(queue).length > 0;
}

export function markCinemaBeatFromChildJob(
  queue: CinemaQueue,
  jobId: string,
  child: { status: string; error?: string | null },
): CinemaQueue {
  const beat = cinemaBeatByJobId(queue, jobId);
  if (!beat) return queue;
  if (child.status === "done") {
    return patchCinemaBeat(queue, beat.id, { status: "ready", error: "" });
  }
  if (child.status === "failed") {
    return patchCinemaBeat(queue, beat.id, {
      status: "rejected",
      error: formatCinemaFalError(child.error),
    });
  }
  if (isInFlightJobStatus(child.status)) {
    return patchCinemaBeat(queue, beat.id, { status: "generating" });
  }
  return queue;
}

export function inFlightCinemaBeats(
  queue: CinemaQueue,
  children?: Array<{ id: string; status: string }> | null,
): CinemaBeat[] {
  const byId = new Map((children || []).map((c) => [c.id, c]));
  return queue.beats.filter((b) => {
    if (b.status === "generating") return true;
    if (!b.job_id) return false;
    const child = byId.get(b.job_id);
    return Boolean(child && isInFlightJobStatus(child.status));
  });
}

export function cinemaParentJobStatus(
  queue: CinemaQueue,
  children?: Array<{ id: string; status: string }> | null,
): "queued" | "running" {
  return inFlightCinemaBeats(queue, children).length ? "running" : "queued";
}

export function cinemaAlreadyRunningReason(
  queue: CinemaQueue,
  beatId: string,
  child?: { id?: string; status?: string } | null,
): string | null {
  const beat = findCinemaBeat(queue, beatId);
  if (!beat) return null;
  if (beat.status === "generating") return "Beat is already generating";
  if (child && isInFlightJobStatus(child.status)) return "Beat is already generating";
  return null;
}

export function applyChildJobsToCinemaQueue(
  queue: CinemaQueue,
  children: Array<{ id: string; status: string; error?: string | null }>,
): CinemaQueue {
  let next = queue;
  for (const child of children) {
    next = markCinemaBeatFromChildJob(next, child.id, child);
  }
  return next;
}

export function bindCinemaQueueToJobs(
  queue: CinemaQueue,
  jobs: Array<{
    id: string;
    status: string;
    error?: string | null;
    card?: unknown;
    recipe?: string;
  }>,
  parentId?: string | null,
): CinemaQueue {
  let next = applyChildJobsToCinemaQueue(queue, jobs);
  for (const job of jobs) {
    const rec =
      job.card && typeof job.card === "object" && !Array.isArray(job.card)
        ? (job.card as Record<string, unknown>)
        : {};
    const beatId = typeof rec.beat_id === "string" ? rec.beat_id.trim() : "";
    const queueId = typeof rec.queue_id === "string" ? rec.queue_id.trim() : "";
    if (parentId && queueId && queueId !== parentId) continue;
    if (!beatId || !findCinemaBeat(next, beatId)) continue;
    if (isInFlightJobStatus(job.status)) {
      const beat = findCinemaBeat(next, beatId);
      if (beat && (beat.status !== "generating" || beat.job_id !== job.id)) {
        next = markCinemaBeatGenerating(next, beatId, job.id);
      }
    } else if (job.status === "done" || job.status === "failed") {
      next = markCinemaBeatFromChildJob(
        beatId && !cinemaBeatByJobId(next, job.id)
          ? patchCinemaBeat(next, beatId, { job_id: job.id })
          : next,
        job.id,
        job,
      );
    }
  }
  return next;
}

export function applyPrevClipToNext(queue: CinemaQueue, beatIndex: number, videoUrl: string): CinemaQueue {
  const url = videoUrl.trim();
  if (!url || !queue.pass_prev_video) return queue;
  const beats = queue.beats.slice();
  const next = beats[beatIndex + 1];
  if (!next) return queue;
  beats[beatIndex + 1] = { ...next, video_ref_url: url };
  return { ...queue, beats };
}

export function canGenerateCinemaBeat(
  queue: CinemaQueue,
  beatId: string,
  child?: { id?: string; status?: string } | null,
  opts?: { retry?: boolean },
): { ok: boolean; reason?: string; beat?: CinemaBeat; index?: number } {
  const idx = queue.beats.findIndex((b) => b.id === beatId);
  if (idx < 0) return { ok: false, reason: "Beat not found" };
  const beat = queue.beats[idx];
  const already = cinemaAlreadyRunningReason(queue, beatId, child);
  if (already) return { ok: false, reason: already, beat, index: idx };
  if (beat.status === "rejected" && beat.error.trim() && !opts?.retry) {
    return { ok: false, reason: "Dismiss or retry the failed beat first", beat, index: idx };
  }
  const otherHold = failedHoldCinemaBeats(queue).find((b) => b.id !== beatId);
  if (otherHold && !opts?.retry) {
    return { ok: false, reason: "Dismiss or retry the failed beat first", beat, index: idx };
  }
  if (!beat.prompt.trim()) return { ok: false, reason: "Beat needs a cinema prompt", beat, index: idx };
  if (!queue.image_urls.length) {
    return { ok: false, reason: "Add at least one identity / ref image URL", beat, index: idx };
  }
  if (idx > 0) {
    const prev = queue.beats[idx - 1];
    const prevOk = prev.status === "ready" || prev.status === "approved";
    if (!prevOk) {
      return { ok: false, reason: "Generate the previous beat first (sequential cinema queue)", beat, index: idx };
    }
  }
  return { ok: true, beat, index: idx };
}

export function nextGeneratableCinemaBeat(queue: CinemaQueue): CinemaBeat | null {
  for (const b of queue.beats) {
    if (b.status === "generating") return null;
    if (b.status === "rejected" && b.error.trim()) return null;
    if (b.status === "ready" || b.status === "approved") continue;
    const gate = canGenerateCinemaBeat(queue, b.id);
    if (gate.ok) return gate.beat || b;
    return null;
  }
  return null;
}

export function cinemaGenerateClientError(body: {
  child?: { id?: string } | null;
  dryRun?: boolean;
  refused?: boolean;
  already_running?: boolean;
  reply?: string;
  error?: string;
  note?: string;
}): string | null {
  if (body.refused) return body.reply || body.error || "Cinema refused this prompt.";
  if (body.dryRun) return null;
  if (body.already_running && body.child?.id) return null;
  if (body.child?.id) return null;
  return (
    body.error ||
    body.note ||
    "Cinema returned OK but did not start a clip job. Plan beats first, then hit Run remaining."
  );
}

export function cinemaRunningNotice(
  queue: CinemaQueue,
  children?: Array<{ id: string; status: string }> | null,
): string | null {
  const beat = inFlightCinemaBeats(queue, children)[0];
  if (!beat) return null;
  const jobId = beat.job_id || "";
  return jobId ? `fal running… beat ${jobId}` : "fal running…";
}

export function cinemaPrimaryBusy(
  stage: string | null | undefined,
  queue: CinemaQueue,
  children?: Array<{ id: string; status: string }> | null,
): boolean {
  return Boolean(stage) || inFlightCinemaBeats(queue, children).length > 0;
}

export function cinemaStitchBlockers(queue: CinemaQueue): string[] {
  if (queue.beats.length < 1) return ["Plan beats first"];
  const blockers: string[] = [];
  queue.beats.forEach((b, i) => {
    if (b.status !== "approved") blockers.push(`Beat ${i + 1} is ${b.status}, not approved`);
    if (!b.job_id) blockers.push(`Beat ${i + 1} has no clip job`);
  });
  return blockers;
}

export function canStitchCinema(queue: CinemaQueue): { ok: boolean; reason?: string } {
  const blockers = cinemaStitchBlockers(queue);
  if (blockers.length) return { ok: false, reason: blockers[0] };
  return { ok: true };
}

export function approvedCinemaJobIds(queue: CinemaQueue): string[] {
  return queue.beats.filter((b) => b.status === "approved" && b.job_id).map((b) => b.job_id);
}

export function cinemaProgress(queue: CinemaQueue): {
  ready: number;
  approved: number;
  total: number;
  generating: number;
} {
  return {
    ready: queue.beats.filter((b) => b.status === "ready" || b.status === "approved").length,
    approved: queue.beats.filter((b) => b.status === "approved").length,
    total: queue.beats.length,
    generating: queue.beats.filter((b) => b.status === "generating").length,
  };
}

export function remainingCinemaSeconds(queue: CinemaQueue): number {
  return queue.beats
    .filter((b) => b.status === "draft" || (b.status === "rejected" && !b.error.trim()))
    .reduce((s, b) => s + b.seconds, 0);
}

export { BEAT_STATUSES };
export type { BeatStatus };
