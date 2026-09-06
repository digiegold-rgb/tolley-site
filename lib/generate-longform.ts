/**
 * Motion 2 / longform — Wan 3.0 I2V segments (5 / 15 / 30s; default 15s)
 * chained by last-frame extract.
 *
 * Honest: a “3 min take” is N beats + ffmpeg last frame → next
 * source_image_url + stitch. Not one native 3-min Wan call.
 *
 * Persisted on a parent GenerateJob (recipe fal-wan-longform) as cardJson.
 * Child clips reuse fal-wan-i2v / flf2v. Stitch reuses fal-wan-stitch.
 * Motion 1 (fal-wan-beats filmstrip) is unchanged.
 */

import {
  DEFAULT_MOTION_NEGATIVE,
  DEFAULT_MOTION_PROMPT,
  MOTION_ASPECTS,
  MOTION_RESOLUTION_DEFAULT,
  MOTION_RESOLUTIONS,
  MOTION_SECONDS_LONGFORM_DEFAULT,
  clampMotionSeconds,
  parseGenerateMotionCard,
  wan30UsdEstimate,
  type MotionResolution,
  type GenerateMotionCard,
  type MotionAspect,
} from "./generate-motion-card";
import {
  BEAT_STATUSES,
  STITCH_RECIPE,
  isBeatStatus,
  type BeatStatus,
  type MotionBeat,
} from "./generate-beats";

export const LONGFORM_RECIPE = "fal-wan-longform" as const;
export { STITCH_RECIPE };

export const LONGFORM_TARGET_DEFAULT = 180;
export const LONGFORM_TARGET_MIN = 5;
export const LONGFORM_TARGET_MAX = 300;
export const LONGFORM_BEAT_SECONDS = MOTION_SECONDS_LONGFORM_DEFAULT;
export const LONGFORM_CONTINUITY = "last_frame" as const;

export function isLongformRecipe(recipe: string | null | undefined): boolean {
  return recipe === LONGFORM_RECIPE;
}

export type LongformBeat = MotionBeat & {
  /** Gated PNG of this clip’s last frame (filled after generate). */
  last_frame_url: string;
};

export type LongformQueue = {
  recipe: typeof LONGFORM_RECIPE;
  title: string;
  target_seconds: number;
  beat_seconds: number;
  continuity: typeof LONGFORM_CONTINUITY;
  source_image_url: string;
  script: string;
  aspect: MotionAspect;
  end_image_url: string;
  beats: LongformBeat[];
  stitch_job_id: string;
  stitch_error: string;
  continuity_error: string;
};

export type LongformEstimate = {
  target_seconds: number;
  beat_seconds: number;
  beat_count: number;
  fal_calls: number;
  planned_seconds: number;
  note: string;
};

export function clampTargetSeconds(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return LONGFORM_TARGET_DEFAULT;
  return Math.min(LONGFORM_TARGET_MAX, Math.max(LONGFORM_TARGET_MIN, Math.round(n)));
}

export function beatCountForDuration(
  targetSeconds: number,
  beatSeconds: number = LONGFORM_BEAT_SECONDS,
): number {
  const t = clampTargetSeconds(targetSeconds);
  const b = beatSeconds > 0 ? beatSeconds : LONGFORM_BEAT_SECONDS;
  return Math.max(1, Math.ceil(t / b));
}

export function estimateLongform(opts: {
  targetSeconds?: unknown;
  beatSeconds?: unknown;
  script?: string;
}): LongformEstimate {
  const beatSeconds = clampMotionSeconds(opts.beatSeconds, LONGFORM_BEAT_SECONDS);
  const fromScript = parseScriptLines(opts.script || "").length;
  const fromDuration = beatCountForDuration(clampTargetSeconds(opts.targetSeconds), beatSeconds);
  const beatCount = fromScript > 0 ? Math.max(fromScript, fromDuration) : fromDuration;
  const planned = beatCount * beatSeconds;
  const usd720 = wan30UsdEstimate(planned, "720p");
  const usd1080 = wan30UsdEstimate(planned, "1080p");
  return {
    target_seconds: clampTargetSeconds(opts.targetSeconds),
    beat_seconds: beatSeconds,
    beat_count: beatCount,
    fal_calls: beatCount,
    planned_seconds: planned,
    note:
      `${beatCount} Wan 3.0 I2V calls × ${beatSeconds}s ≈ ${planned}s take ` +
      `(~$${usd720.toFixed(2)} @720p / ~$${usd1080.toFixed(2)} @1080p). ` +
      `Not one native ${planned}s Wan job — last-frame chain + stitch.`,
  };
}

export function parseScriptLines(script: string): string[] {
  return (script || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"));
}

export function newLongformBeatId(): string {
  return `lf_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function emptyLongformBeat(partial?: Partial<LongformBeat>): LongformBeat {
  const source = (partial?.source_image_url || "").trim();
  return {
    id: partial?.id || newLongformBeatId(),
    status: isBeatStatus(partial?.status) ? partial.status : "draft",
    prompt: (partial?.prompt || "").trim() || DEFAULT_MOTION_PROMPT,
    negative_prompt: partial?.negative_prompt ?? DEFAULT_MOTION_NEGATIVE,
    source_image_url: source,
    end_image_url: (partial?.end_image_url || "").trim(),
    aspect: (MOTION_ASPECTS as readonly string[]).includes(String(partial?.aspect))
      ? (partial!.aspect as MotionAspect)
      : "9:16",
    seconds: clampMotionSeconds(partial?.seconds, LONGFORM_BEAT_SECONDS),
    resolution: (MOTION_RESOLUTIONS as readonly string[]).includes(String(partial?.resolution))
      ? (partial!.resolution as MotionResolution)
      : MOTION_RESOLUTION_DEFAULT,
    audio: partial?.audio === true,
    seed: Number.isFinite(Number(partial?.seed)) ? Number(partial?.seed) : 0,
    slow_mo: partial?.slow_mo === true,
    from_prev_last: partial?.from_prev_last === true,
    job_id: (partial?.job_id || "").trim(),
    error: (partial?.error || "").trim(),
    last_frame_url: (partial?.last_frame_url || "").trim(),
  };
}

export function emptyLongformQueue(partial?: Partial<LongformQueue>): LongformQueue {
  return {
    recipe: LONGFORM_RECIPE,
    title: (partial?.title || "").trim() || "Longform take",
    target_seconds: clampTargetSeconds(partial?.target_seconds ?? LONGFORM_TARGET_DEFAULT),
    beat_seconds: clampMotionSeconds(partial?.beat_seconds, LONGFORM_BEAT_SECONDS),
    continuity: LONGFORM_CONTINUITY,
    source_image_url: (partial?.source_image_url || "").trim(),
    script: typeof partial?.script === "string" ? partial.script : "",
    aspect: (MOTION_ASPECTS as readonly string[]).includes(String(partial?.aspect))
      ? (partial!.aspect as MotionAspect)
      : "9:16",
    end_image_url: (partial?.end_image_url || "").trim(),
    beats: Array.isArray(partial?.beats) ? partial.beats.map((b) => emptyLongformBeat(b)) : [],
    stitch_job_id: (partial?.stitch_job_id || "").trim(),
    stitch_error: (partial?.stitch_error || "").trim(),
    continuity_error: (partial?.continuity_error || "").trim(),
  };
}

function asRecord(raw: unknown): Record<string, unknown> {
  return raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
}

export function parseLongformBeat(raw: unknown): LongformBeat {
  const rec = asRecord(raw);
  const beat = emptyLongformBeat({
    id: typeof rec.id === "string" ? rec.id : undefined,
    status: isBeatStatus(rec.status) ? rec.status : "draft",
    prompt: typeof rec.prompt === "string" ? rec.prompt : undefined,
    negative_prompt: typeof rec.negative_prompt === "string" ? rec.negative_prompt : undefined,
    source_image_url: typeof rec.source_image_url === "string" ? rec.source_image_url : undefined,
    end_image_url: typeof rec.end_image_url === "string" ? rec.end_image_url : undefined,
    aspect: rec.aspect as MotionAspect | undefined,
    seconds: rec.seconds as number | undefined,
    resolution: rec.resolution as MotionResolution | undefined,
    audio: rec.audio === true,
    seed: typeof rec.seed === "number" ? rec.seed : Number(rec.seed),
    slow_mo: rec.slow_mo === true,
    from_prev_last: rec.from_prev_last === true || rec.fromPrevLast === true,
    job_id: typeof rec.job_id === "string" ? rec.job_id : typeof rec.jobId === "string" ? rec.jobId : undefined,
    error: typeof rec.error === "string" ? rec.error : undefined,
    last_frame_url:
      typeof rec.last_frame_url === "string"
        ? rec.last_frame_url
        : typeof rec.lastFrameUrl === "string"
          ? rec.lastFrameUrl
          : undefined,
  });
  if (!beat.id) throw new Error("Longform beat needs an id");
  return beat;
}

export function parseLongformQueue(raw: unknown): LongformQueue {
  const rec = asRecord(raw);
  const beatsRaw = Array.isArray(rec.beats) ? rec.beats : [];
  return emptyLongformQueue({
    title: typeof rec.title === "string" ? rec.title : undefined,
    target_seconds: Number.isFinite(Number(rec.target_seconds ?? rec.targetSeconds))
      ? Number(rec.target_seconds ?? rec.targetSeconds)
      : undefined,
    beat_seconds: Number.isFinite(Number(rec.beat_seconds ?? rec.beatSeconds))
      ? Number(rec.beat_seconds ?? rec.beatSeconds)
      : undefined,
    source_image_url:
      typeof rec.source_image_url === "string"
        ? rec.source_image_url
        : typeof rec.sourceImageUrl === "string"
          ? rec.sourceImageUrl
          : undefined,
    script: typeof rec.script === "string" ? rec.script : undefined,
    aspect: rec.aspect as MotionAspect | undefined,
    end_image_url:
      typeof rec.end_image_url === "string"
        ? rec.end_image_url
        : typeof rec.endImageUrl === "string"
          ? rec.endImageUrl
          : undefined,
    beats: beatsRaw.map((b) => parseLongformBeat(b)),
    stitch_job_id:
      typeof rec.stitch_job_id === "string"
        ? rec.stitch_job_id
        : typeof rec.stitchJobId === "string"
          ? rec.stitchJobId
          : undefined,
    stitch_error: typeof rec.stitch_error === "string" ? rec.stitch_error : undefined,
    continuity_error: typeof rec.continuity_error === "string" ? rec.continuity_error : undefined,
  });
}

export function cardIsLongformQueue(card: unknown): boolean {
  const rec = asRecord(card);
  return rec.recipe === LONGFORM_RECIPE;
}

export function promptsForPlan(script: string, beatCount: number, fallbackPrompt: string): string[] {
  const lines = parseScriptLines(script);
  const fallback = fallbackPrompt.trim() || DEFAULT_MOTION_PROMPT;
  if (!lines.length) return Array.from({ length: beatCount }, () => fallback);
  if (lines.length >= beatCount) return lines.slice(0, beatCount);
  const out = lines.slice();
  const pad = lines[lines.length - 1] || fallback;
  while (out.length < beatCount) out.push(pad);
  return out;
}

export function planLongformQueue(opts: {
  targetSeconds?: unknown;
  beatSeconds?: unknown;
  sourceImageUrl: string;
  script?: string;
  fallbackPrompt?: string;
  aspect?: MotionAspect;
  endImageUrl?: string;
  title?: string;
}): LongformQueue {
  const source = (opts.sourceImageUrl || "").trim();
  const estimate = estimateLongform({
    targetSeconds: opts.targetSeconds,
    beatSeconds: opts.beatSeconds,
    script: opts.script,
  });
  const prompts = promptsForPlan(opts.script || "", estimate.beat_count, opts.fallbackPrompt || "");
  const beats = prompts.map((prompt, i) =>
    emptyLongformBeat({
      prompt,
      source_image_url: i === 0 ? source : "",
      from_prev_last: i > 0,
      aspect: opts.aspect,
      end_image_url: opts.endImageUrl,
      seconds: estimate.beat_seconds,
    }),
  );
  return emptyLongformQueue({
    title: opts.title,
    target_seconds: estimate.target_seconds,
    beat_seconds: estimate.beat_seconds,
    source_image_url: source,
    script: opts.script || "",
    aspect: opts.aspect,
    end_image_url: opts.endImageUrl,
    beats,
  });
}

export function motionCardFromLongformBeat(beat: LongformBeat): GenerateMotionCard {
  return parseGenerateMotionCard({
    prompt: beat.prompt,
    negative_prompt: beat.negative_prompt,
    source_image_url: beat.source_image_url,
    end_image_url: beat.end_image_url,
    aspect: beat.aspect,
    seconds: beat.seconds,
    resolution: beat.resolution,
    audio: beat.audio,
    seed: beat.seed,
    slow_mo: beat.slow_mo,
  });
}

export function findLongformBeat(queue: LongformQueue, beatId: string): LongformBeat | null {
  return queue.beats.find((b) => b.id === beatId) || null;
}

export function longformBeatByJobId(queue: LongformQueue, jobId: string): LongformBeat | null {
  return queue.beats.find((b) => b.job_id && b.job_id === jobId) || null;
}

export function patchLongformBeat(
  queue: LongformQueue,
  beatId: string,
  patch: Partial<LongformBeat>,
): LongformQueue {
  const idx = queue.beats.findIndex((b) => b.id === beatId);
  if (idx < 0) throw new Error("Longform beat not found");
  const beats = queue.beats.slice();
  beats[idx] = emptyLongformBeat({ ...beats[idx], ...patch, id: beats[idx].id });
  return { ...queue, beats };
}

export function applyLocalLongformBeatPatch(
  queue: LongformQueue,
  beatId: string,
  patch: Partial<LongformBeat>,
): LongformQueue {
  const idx = queue.beats.findIndex((b) => b.id === beatId);
  if (idx < 0) throw new Error("Longform beat not found");
  const beats = queue.beats.slice();
  beats[idx] = { ...beats[idx], ...patch, id: beats[idx].id };
  return { ...queue, beats };
}

export function setLongformBeatStatus(
  queue: LongformQueue,
  beatId: string,
  status: BeatStatus,
): LongformQueue {
  return patchLongformBeat(queue, beatId, {
    status,
    error: status === "rejected" ? queue.beats.find((b) => b.id === beatId)?.error : "",
  });
}

export function markLongformBeatGenerating(
  queue: LongformQueue,
  beatId: string,
  jobId: string,
): LongformQueue {
  return patchLongformBeat(queue, beatId, { status: "generating", job_id: jobId, error: "" });
}

export function markLongformBeatFromChildJob(
  queue: LongformQueue,
  jobId: string,
  child: { status: string; error?: string | null },
): LongformQueue {
  const beat = longformBeatByJobId(queue, jobId);
  if (!beat) return queue;
  if (child.status === "done") {
    return patchLongformBeat(queue, beat.id, { status: "ready", error: "" });
  }
  if (child.status === "failed") {
    return patchLongformBeat(queue, beat.id, {
      status: "rejected",
      error: (child.error || "generation failed").slice(0, 500),
    });
  }
  if (child.status === "running" || child.status === "queued") {
    return patchLongformBeat(queue, beat.id, { status: "generating" });
  }
  return queue;
}

/**
 * Wire beat k’s extracted last frame into beat k+1’s source.
 * This is the continuity Motion 1 does not do (it copies the previous still).
 */
export function applyLastFrameToNext(
  queue: LongformQueue,
  beatIndex: number,
  lastFrameUrl: string,
): LongformQueue {
  const url = lastFrameUrl.trim();
  if (!url) return queue;
  const beats = queue.beats.slice();
  if (!beats[beatIndex]) return queue;
  beats[beatIndex] = { ...beats[beatIndex], last_frame_url: url };
  const next = beats[beatIndex + 1];
  if (next && (next.from_prev_last || !next.source_image_url.trim())) {
    beats[beatIndex + 1] = {
      ...next,
      source_image_url: url,
      from_prev_last: true,
    };
  }
  return { ...queue, beats, continuity_error: "" };
}

/**
 * After regenerating beat k: re-chain last frame into k+1 and drop later
 * clips so they must be generated again (opt-in ripple).
 */
export function rippleContinuityAfter(
  queue: LongformQueue,
  beatIndex: number,
  lastFrameUrl: string,
): LongformQueue {
  let next = applyLastFrameToNext(queue, beatIndex, lastFrameUrl);
  const beats = next.beats.slice();
  for (let i = beatIndex + 1; i < beats.length; i++) {
    beats[i] = emptyLongformBeat({
      ...beats[i],
      status: "draft",
      job_id: "",
      last_frame_url: "",
      error: "",
      source_image_url: i === beatIndex + 1 ? lastFrameUrl.trim() : "",
      from_prev_last: true,
    });
  }
  next = { ...next, beats, stitch_job_id: "", stitch_error: "" };
  return next;
}

export function canGenerateLongformBeat(
  queue: LongformQueue,
  beatId: string,
): { ok: boolean; reason?: string; beat?: LongformBeat; index?: number } {
  const idx = queue.beats.findIndex((b) => b.id === beatId);
  if (idx < 0) return { ok: false, reason: "Beat not found" };
  const beat = queue.beats[idx];
  if (beat.status === "generating") return { ok: false, reason: "Beat is already generating", beat, index: idx };
  if (!beat.prompt.trim()) return { ok: false, reason: "Beat needs a motion prompt", beat, index: idx };
  if (idx > 0) {
    const prev = queue.beats[idx - 1];
    const prevOk = prev.status === "ready" || prev.status === "approved";
    if (!beat.source_image_url.trim() && !prev.last_frame_url.trim()) {
      return {
        ok: false,
        reason: prevOk
          ? "Previous beat has no last frame yet — extract failed or is still running"
          : "Generate the previous beat first (last-frame chain)",
        beat,
        index: idx,
      };
    }
  }
  if (!beat.source_image_url.trim() && idx === 0) {
    return { ok: false, reason: "Beat 1 needs the keep still", beat, index: idx };
  }
  return { ok: true, beat, index: idx };
}

export function ensureBeatSourceFromPrev(queue: LongformQueue, beatId: string): LongformQueue {
  const idx = queue.beats.findIndex((b) => b.id === beatId);
  if (idx <= 0) return queue;
  const beat = queue.beats[idx];
  if (beat.source_image_url.trim()) return queue;
  const prev = queue.beats[idx - 1];
  const src = (prev.last_frame_url || "").trim();
  if (!src) return queue;
  return applyLastFrameToNext(queue, idx - 1, src);
}

export function nextGeneratableLongformBeat(queue: LongformQueue): LongformBeat | null {
  for (let i = 0; i < queue.beats.length; i++) {
    const b = queue.beats[i];
    if (b.status === "generating") return null;
    if (b.status === "ready" || b.status === "approved") continue;
    const gate = canGenerateLongformBeat(ensureBeatSourceFromPrev(queue, b.id), b.id);
    if (gate.ok) return gate.beat || b;
    return null;
  }
  return null;
}

export function longformStitchBlockers(queue: LongformQueue): string[] {
  if (queue.beats.length < 1) return ["Plan beats first"];
  const blockers: string[] = [];
  queue.beats.forEach((b, i) => {
    if (b.status !== "approved") blockers.push(`Beat ${i + 1} is ${b.status}, not approved`);
    if (!b.job_id) blockers.push(`Beat ${i + 1} has no clip job`);
  });
  return blockers;
}

export function canStitchLongform(queue: LongformQueue): { ok: boolean; reason?: string } {
  const blockers = longformStitchBlockers(queue);
  if (blockers.length) return { ok: false, reason: blockers[0] };
  return { ok: true };
}

export function approvedLongformJobIds(queue: LongformQueue): string[] {
  return queue.beats.filter((b) => b.status === "approved" && b.job_id).map((b) => b.job_id);
}

export function longformProgress(queue: LongformQueue): {
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

export { BEAT_STATUSES };
export type { BeatStatus };
