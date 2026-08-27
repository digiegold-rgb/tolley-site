/**
 * lib/vater/animate-layer.ts
 *
 * Honest productization of a "~30s motion layer" on a finished Library item.
 *
 * There is no sliced 30-second clip control on the Wan / i2v backend. The
 * batch path (`POST /animate-all`) animates whole scenes. This module picks
 * the scenes that overlap the opening window and quotes them with the same
 * per-clip prices as VisualsStep (`getAnimationPriceCents`).
 *
 * Window rule: a scene is in the layer when it BEGINS before `windowS`.
 * The last clip may run a few seconds past the mark — we never pretend the
 * GPU cut a single 30s file.
 */

import {
  animationOptionLabel,
  getAnimationPrice,
  getAnimationPriceCents,
} from "@/lib/vater/pricing";
import type { AnimationQuality } from "@/lib/vater/video-spec";

/** Opening window the Library action quotes. Whole scenes, not a slice. */
export const ANIMATE_LAYER_WINDOW_S = 30;

/**
 * Opening-motion choices offered at CREATE time (Trey brief 2026-08-27, ship
 * item 5: "Animate selector at create: none / first 30 seconds / first 1
 * minute / first 2 minutes. Default first 30 seconds").
 *
 * Default is 30, not 120: the signal that started this was a competitor
 * ("The Dollar Paradigm") popping to 400+ subs on animation in the FIRST TEN
 * SECONDS, and animating a whole 12-minute piece on the first pass is how a
 * customer lights money on fire before they have even read the script back.
 * `0` means stills only — POST /from-script maps a non-positive value to a
 * null column, which the render manifest renders as "Stills only".
 */
export const ANIMATE_WINDOW_OPTIONS = [
  { value: 0, label: "None — stills only", hint: "Ken Burns on every scene. Animate individual scenes later, per scene." },
  { value: 30, label: "First 30 seconds", hint: "The opening hook. Recommended — this is the part that decides whether anyone keeps watching." },
  { value: 60, label: "First 1 minute", hint: "Roughly twice the clips, twice the opening cost." },
  { value: 120, label: "First 2 minutes", hint: "Only worth it on a long piece you have already read back." },
] as const;

/** What a new project gets when nobody picks. */
export const ANIMATE_WINDOW_DEFAULT_S = 30;

/** Same default as POST /animate-all and VisualsStep. */
export const ANIMATE_LAYER_DEFAULT_QUALITY = "modal-wan22-narrative" as const;

/** Qualities the cheap-batch Modal path actually accepts. */
export const ANIMATE_LAYER_QUALITIES = [
  "modal-wan22",
  "modal-wan22-fast",
  "modal-wan22-narrative",
  "modal-wan22-narrative-fast",
  "modal-hunyuan-narrative",
  "modal-hunyuan-narrative-fast",
  // Animate-2 motion transfer: batched per scene on the DGX (one L40S
  // container per clip), driver clips rotate through the owner's library.
  "modal-animate2",
] as const;

export type AnimateLayerQuality = (typeof ANIMATE_LAYER_QUALITIES)[number];

const QUALITY_SET = new Set<string>(ANIMATE_LAYER_QUALITIES);

export function isAnimateLayerQuality(
  value: unknown,
): value is AnimateLayerQuality {
  return typeof value === "string" && QUALITY_SET.has(value);
}

export function resolveAnimateLayerQuality(
  value: unknown,
): AnimateLayerQuality {
  return isAnimateLayerQuality(value)
    ? value
    : ANIMATE_LAYER_DEFAULT_QUALITY;
}

export type AnimateLayerSceneLike = {
  idx?: unknown;
  startS?: unknown;
  endS?: unknown;
  videoUrl?: unknown;
};

export type AnimateLayerFallback = "timings" | "equal-share" | "first-scene";

export interface AnimateLayerPlan {
  windowS: number;
  sceneIdxs: number[];
  coverageStartS: number;
  coverageEndS: number;
  /** True when at least one scene had a real startS < endS window. */
  timed: boolean;
  /** How we chose scenes when timings were missing or partial. */
  fallback: AnimateLayerFallback;
  /** Scenes in the window that already have a clip and were left alone. */
  skippedAnimatedIdxs: number[];
}

function asIdx(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : fallback;
}

function asSec(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return value;
}

function hasTiming(scene: AnimateLayerSceneLike): boolean {
  const start = asSec(scene.startS);
  const end = asSec(scene.endS);
  return start !== null && end !== null && end > start;
}

function hasVideo(scene: AnimateLayerSceneLike): boolean {
  return typeof scene.videoUrl === "string" && scene.videoUrl.trim().length > 0;
}

/**
 * Pick the scenes that belong in an opening motion layer.
 *
 * `includeAnimated` (force) re-quotes scenes that already have a videoUrl.
 * Default skips them so a second click does not silently re-bill.
 */
export function planAnimateLayer(
  scenes: AnimateLayerSceneLike[] | unknown,
  opts?: {
    windowS?: number;
    audioDuration?: number | null;
    includeAnimated?: boolean;
  },
): AnimateLayerPlan {
  const windowS = Math.max(
    1,
    Number.isFinite(opts?.windowS) ? Number(opts?.windowS) : ANIMATE_LAYER_WINDOW_S,
  );
  const includeAnimated = opts?.includeAnimated === true;
  const list = Array.isArray(scenes) ? scenes : [];

  const normalized = list.map((raw, i) => {
    const scene = (raw ?? {}) as AnimateLayerSceneLike;
    const timed = hasTiming(scene);
    return {
      idx: asIdx(scene.idx, i),
      startS: asSec(scene.startS) ?? 0,
      endS: asSec(scene.endS) ?? 0,
      timed,
      animated: hasVideo(scene),
    };
  });

  let fallback: AnimateLayerFallback = "timings";
  let candidates: typeof normalized = [];

  if (normalized.some((s) => s.timed)) {
    fallback = "timings";
    candidates = normalized.filter((s) => s.startS < windowS);
  } else {
    const audio =
      typeof opts?.audioDuration === "number" && opts.audioDuration > 0
        ? opts.audioDuration
        : 0;
    if (audio > 0 && normalized.length > 0) {
      fallback = "equal-share";
      const share = audio / normalized.length;
      candidates = normalized.map((s, i) => ({
        ...s,
        startS: i * share,
        endS: (i + 1) * share,
        timed: true,
      })).filter((s) => s.startS < windowS);
    } else {
      fallback = "first-scene";
      candidates = normalized.slice(0, 1);
    }
  }

  const skippedAnimatedIdxs = includeAnimated
    ? []
    : candidates.filter((s) => s.animated).map((s) => s.idx);

  const selected = includeAnimated
    ? candidates
    : candidates.filter((s) => !s.animated);

  const coverageStartS = selected.length
    ? Math.min(...selected.map((s) => s.startS))
    : 0;
  const coverageEndS = selected.length
    ? Math.max(...selected.map((s) => (s.endS > s.startS ? s.endS : s.startS)))
    : 0;

  return {
    windowS,
    sceneIdxs: selected.map((s) => s.idx),
    coverageStartS,
    coverageEndS,
    timed: fallback === "timings" || fallback === "equal-share",
    fallback,
    skippedAnimatedIdxs,
  };
}

export interface AnimateLayerQuote extends AnimateLayerPlan {
  quality: AnimateLayerQuality;
  qualityLabel: string;
  priceCentsPerClip: number;
  estimateCents: number;
}

export function quoteAnimateLayer(
  plan: AnimateLayerPlan,
  quality: AnimateLayerQuality,
): AnimateLayerQuote {
  const priceCentsPerClip = getAnimationPriceCents(quality);
  return {
    ...plan,
    quality,
    qualityLabel: animationOptionLabel(quality as AnimationQuality),
    priceCentsPerClip,
    estimateCents: plan.sceneIdxs.length * priceCentsPerClip,
  };
}

/** Customer-facing limit line — never claims a sliced 30s file. */
export function animateLayerLimitCopy(plan: AnimateLayerPlan): string {
  if (plan.fallback === "first-scene") {
    return "Scene timings are missing on this cut, so the layer runs the first scene only — whole clip, not a sliced 30s file.";
  }
  if (plan.fallback === "equal-share") {
    return `Scenes that cover the opening ${plan.windowS}s, split evenly across the narration. Whole scenes, not a sliced ${plan.windowS}s file.`;
  }
  return `Wan motion on every scene that begins in the first ${plan.windowS}s. The last clip may run past the mark — we animate whole scenes, not a sliced ${plan.windowS}s file.`;
}

/** One-line coverage, e.g. "0:00–0:34 · 4 clips". */
export function formatAnimateLayerCoverage(plan: AnimateLayerPlan): string {
  const clips = plan.sceneIdxs.length;
  const clipLabel = `${clips} clip${clips === 1 ? "" : "s"}`;
  if (!plan.timed || clips === 0) return clipLabel;
  return `${fmtClock(plan.coverageStartS)}–${fmtClock(plan.coverageEndS)} · ${clipLabel}`;
}

function fmtClock(seconds: number): string {
  const safe = Math.max(0, Math.round(seconds));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function animateLayerPriceUsd(cents: number): number {
  return Math.round(cents) / 100;
}

/** Guard: getAnimationPrice throws on unknown tiers; quote path must not. */
export function safeAnimationPriceCents(quality: string): number {
  return getAnimationPrice(quality)?.priceCents ?? 0;
}
