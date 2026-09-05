/**
 * Multi-beat Motion queue — one Wan clip per beat, review, then stitch.
 *
 * Persisted on a parent GenerateJob (recipe fal-wan-beats) as cardJson.
 * Each beat's clip is a child GenerateJob (fal-wan-i2v / flf2v). No extra
 * Prisma model. Stitch is explicit — never auto-run on Go.
 */

import {
  DEFAULT_MOTION_NEGATIVE,
  DEFAULT_MOTION_PROMPT,
  MOTION_ASPECTS,
  MOTION_SECONDS_DEFAULT,
  emptyMotionCard,
  parseGenerateMotionCard,
  type GenerateMotionCard,
  type MotionAspect,
} from "./generate-motion-card";

export const BEATS_RECIPE = "fal-wan-beats" as const;
export const STITCH_RECIPE = "fal-wan-stitch" as const;

export const BEAT_STATUSES = ["draft", "generating", "ready", "approved", "rejected"] as const;
export type BeatStatus = (typeof BEAT_STATUSES)[number];

export function isBeatStatus(value: unknown): value is BeatStatus {
  return typeof value === "string" && (BEAT_STATUSES as readonly string[]).includes(value);
}

export function isBeatsRecipe(recipe: string | null | undefined): boolean {
  return recipe === BEATS_RECIPE;
}

export function isStitchRecipe(recipe: string | null | undefined): boolean {
  return recipe === STITCH_RECIPE;
}

export type MotionBeat = {
  id: string;
  status: BeatStatus;
  prompt: string;
  negative_prompt: string;
  source_image_url: string;
  end_image_url: string;
  aspect: MotionAspect;
  seconds: number;
  seed: number;
  slow_mo: boolean;
  /** When true and this is not beat 0, source is "last frame of previous" intent. */
  from_prev_last: boolean;
  job_id: string;
  error: string;
};

export type BeatQueue = {
  recipe: typeof BEATS_RECIPE;
  title: string;
  beats: MotionBeat[];
  stitch_job_id: string;
  stitch_error: string;
};

export function newBeatId(): string {
  return `beat_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function emptyBeat(partial?: Partial<MotionBeat>): MotionBeat {
  const source = (partial?.source_image_url || "").trim();
  return {
    id: partial?.id || newBeatId(),
    status: isBeatStatus(partial?.status) ? partial.status : "draft",
    prompt: (partial?.prompt || "").trim() || DEFAULT_MOTION_PROMPT,
    negative_prompt: partial?.negative_prompt ?? DEFAULT_MOTION_NEGATIVE,
    source_image_url: source,
    end_image_url: (partial?.end_image_url || "").trim(),
    aspect: (MOTION_ASPECTS as readonly string[]).includes(String(partial?.aspect))
      ? (partial!.aspect as MotionAspect)
      : "9:16",
    seconds: MOTION_SECONDS_DEFAULT,
    seed: Number.isFinite(Number(partial?.seed)) ? Number(partial?.seed) : 0,
    slow_mo: partial?.slow_mo === true,
    from_prev_last: partial?.from_prev_last === true,
    job_id: (partial?.job_id || "").trim(),
    error: (partial?.error || "").trim(),
  };
}

export function emptyBeatQueue(partial?: Partial<BeatQueue>): BeatQueue {
  return {
    recipe: BEATS_RECIPE,
    title: (partial?.title || "").trim() || "Beat queue",
    beats: Array.isArray(partial?.beats) ? partial.beats.map((b) => emptyBeat(b)) : [],
    stitch_job_id: (partial?.stitch_job_id || "").trim(),
    stitch_error: (partial?.stitch_error || "").trim(),
  };
}

function asRecord(raw: unknown): Record<string, unknown> {
  return raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
}

export function parseMotionBeat(raw: unknown): MotionBeat {
  const rec = asRecord(raw);
  const beat = emptyBeat({
    id: typeof rec.id === "string" ? rec.id : undefined,
    status: isBeatStatus(rec.status) ? rec.status : "draft",
    prompt: typeof rec.prompt === "string" ? rec.prompt : undefined,
    negative_prompt: typeof rec.negative_prompt === "string" ? rec.negative_prompt : undefined,
    source_image_url: typeof rec.source_image_url === "string" ? rec.source_image_url : undefined,
    end_image_url: typeof rec.end_image_url === "string" ? rec.end_image_url : undefined,
    aspect: rec.aspect as MotionAspect | undefined,
    seed: typeof rec.seed === "number" ? rec.seed : Number(rec.seed),
    slow_mo: rec.slow_mo === true,
    from_prev_last: rec.from_prev_last === true || rec.fromPrevLast === true,
    job_id: typeof rec.job_id === "string" ? rec.job_id : typeof rec.jobId === "string" ? rec.jobId : undefined,
    error: typeof rec.error === "string" ? rec.error : undefined,
  });
  if (!beat.id) throw new Error("Beat needs an id");
  return beat;
}

export function parseBeatQueue(raw: unknown): BeatQueue {
  const rec = asRecord(raw);
  const beatsRaw = Array.isArray(rec.beats) ? rec.beats : [];
  return emptyBeatQueue({
    title: typeof rec.title === "string" ? rec.title : undefined,
    beats: beatsRaw.map((b) => parseMotionBeat(b)),
    stitch_job_id:
      typeof rec.stitch_job_id === "string"
        ? rec.stitch_job_id
        : typeof rec.stitchJobId === "string"
          ? rec.stitchJobId
          : undefined,
    stitch_error: typeof rec.stitch_error === "string" ? rec.stitch_error : undefined,
  });
}

export function beatFromMotionCard(
  card: GenerateMotionCard | ReturnType<typeof emptyMotionCard>,
  partial?: Partial<MotionBeat>,
): MotionBeat {
  return emptyBeat({
    ...partial,
    prompt: card.prompt,
    negative_prompt: card.negative_prompt,
    source_image_url: card.source_image_url,
    end_image_url: card.end_image_url || "",
    aspect: card.aspect,
    seed: card.seed,
    slow_mo: "slow_mo" in card && card.slow_mo === true,
  });
}

export function motionCardFromBeat(beat: MotionBeat): GenerateMotionCard {
  return parseGenerateMotionCard({
    prompt: beat.prompt,
    negative_prompt: beat.negative_prompt,
    source_image_url: beat.source_image_url,
    end_image_url: beat.end_image_url,
    aspect: beat.aspect,
    seconds: beat.seconds,
    seed: beat.seed,
    slow_mo: beat.slow_mo,
  });
}

export function addBeat(queue: BeatQueue, beat?: Partial<MotionBeat>): BeatQueue {
  const next = emptyBeat(beat);
  if (queue.beats.some((b) => b.id === next.id)) {
    throw new Error("Beat id already in the queue");
  }
  return { ...queue, beats: [...queue.beats, next], stitch_job_id: "", stitch_error: "" };
}

export function removeBeat(queue: BeatQueue, beatId: string): BeatQueue {
  return {
    ...queue,
    beats: queue.beats.filter((b) => b.id !== beatId),
    stitch_job_id: "",
    stitch_error: "",
  };
}

export function moveBeat(queue: BeatQueue, beatId: string, delta: -1 | 1): BeatQueue {
  const idx = queue.beats.findIndex((b) => b.id === beatId);
  if (idx < 0) throw new Error("Beat not found");
  const dest = idx + delta;
  if (dest < 0 || dest >= queue.beats.length) return queue;
  const beats = queue.beats.slice();
  const [item] = beats.splice(idx, 1);
  beats.splice(dest, 0, item);
  return { ...queue, beats, stitch_job_id: "", stitch_error: "" };
}

export function patchBeat(queue: BeatQueue, beatId: string, patch: Partial<MotionBeat>): BeatQueue {
  const idx = queue.beats.findIndex((b) => b.id === beatId);
  if (idx < 0) throw new Error("Beat not found");
  const beats = queue.beats.slice();
  beats[idx] = emptyBeat({ ...beats[idx], ...patch, id: beats[idx].id });
  return { ...queue, beats };
}

export function setBeatStatus(queue: BeatQueue, beatId: string, status: BeatStatus): BeatQueue {
  return patchBeat(queue, beatId, { status, error: status === "rejected" ? queue.beats.find((b) => b.id === beatId)?.error : "" });
}

export function findBeat(queue: BeatQueue, beatId: string): MotionBeat | null {
  return queue.beats.find((b) => b.id === beatId) || null;
}

export function beatByJobId(queue: BeatQueue, jobId: string): MotionBeat | null {
  return queue.beats.find((b) => b.job_id && b.job_id === jobId) || null;
}

/** Source still for a new beat: last-frame intent uses previous end still, else previous source. */
export function sourceStillFromPrevious(queue: BeatQueue, beatIndex: number): string {
  if (beatIndex <= 0) return "";
  const prev = queue.beats[beatIndex - 1];
  if (!prev) return "";
  return (prev.end_image_url || prev.source_image_url || "").trim();
}

export function applyPrevLastSource(queue: BeatQueue, beatId: string): BeatQueue {
  const idx = queue.beats.findIndex((b) => b.id === beatId);
  if (idx < 0) throw new Error("Beat not found");
  const src = sourceStillFromPrevious(queue, idx);
  return patchBeat(queue, beatId, { source_image_url: src, from_prev_last: true });
}

export function canGenerateBeat(beat: MotionBeat): { ok: boolean; reason?: string } {
  if (beat.status === "generating") return { ok: false, reason: "Beat is already generating" };
  if (!beat.prompt.trim()) return { ok: false, reason: "Beat needs a motion prompt" };
  if (!beat.source_image_url.trim()) return { ok: false, reason: "Beat needs a source still" };
  return { ok: true };
}

export function canApproveBeat(beat: MotionBeat): { ok: boolean; reason?: string } {
  if (beat.status !== "ready" && beat.status !== "rejected") {
    return { ok: false, reason: "Approve a ready (or previously rejected) clip" };
  }
  if (!beat.job_id) return { ok: false, reason: "Beat has no clip yet" };
  return { ok: true };
}

export function stitchBlockers(queue: BeatQueue): string[] {
  if (queue.beats.length < 1) return ["Add at least one beat"];
  const blockers: string[] = [];
  queue.beats.forEach((b, i) => {
    if (b.status !== "approved") {
      blockers.push(`Beat ${i + 1} is ${b.status}, not approved`);
    }
    if (!b.job_id) blockers.push(`Beat ${i + 1} has no clip job`);
  });
  return blockers;
}

export function canStitchBeats(queue: BeatQueue): { ok: boolean; reason?: string } {
  const blockers = stitchBlockers(queue);
  if (blockers.length) return { ok: false, reason: blockers[0] };
  return { ok: true };
}

export function approvedBeatJobIds(queue: BeatQueue): string[] {
  return queue.beats.filter((b) => b.status === "approved" && b.job_id).map((b) => b.job_id);
}

export function markBeatGenerating(queue: BeatQueue, beatId: string, jobId: string): BeatQueue {
  return patchBeat(queue, beatId, { status: "generating", job_id: jobId, error: "" });
}

export function markBeatFromChildJob(
  queue: BeatQueue,
  jobId: string,
  child: { status: string; error?: string | null },
): BeatQueue {
  const beat = beatByJobId(queue, jobId);
  if (!beat) return queue;
  if (child.status === "done") {
    return patchBeat(queue, beat.id, { status: "ready", error: "" });
  }
  if (child.status === "failed") {
    return patchBeat(queue, beat.id, {
      status: "rejected",
      error: (child.error || "generation failed").slice(0, 500),
    });
  }
  if (child.status === "running" || child.status === "queued") {
    return patchBeat(queue, beat.id, { status: "generating" });
  }
  return queue;
}

export function nextBeatActionLabel(beat: MotionBeat): string {
  if (beat.status === "draft") return "Generate this beat";
  if (beat.status === "generating") return "Generating…";
  if (beat.status === "ready") return "Approve";
  if (beat.status === "approved") return "Approved";
  return "Regenerate";
}
