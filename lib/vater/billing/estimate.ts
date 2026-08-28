/**
 * lib/vater/billing/estimate.ts — what a render is expected to cost, BEFORE
 * anyone spends a GPU-second on it.
 *
 * ⚠️ ZERO SERVER IMPORTS, DELIBERATELY (same rule as lib/vater/credit-packs.ts).
 * The numbers here are shown on a public marketing calculator, inside the 402
 * wall, and on the Billing screen — all browser code — and they are also the
 * numbers the estimate route returns. One module, so the price a customer is
 * quoted on the landing page cannot drift from the price the API quotes.
 * Anything needing Prisma or the env-backed ops rate takes it as an argument.
 *
 * TWO ESTIMATES, ALWAYS, because they are wildly different products:
 *   draft — stills only (Ken Burns over generated images). Cheap.
 *   full  — the same video with the wan motion pass over its scenes. ~6× the
 *           compute per finished minute.
 * Quoting only the full number scares people off a draft they could afford;
 * quoting only the draft number is a bill they did not agree to.
 *
 * Where the rates come from (measured 8/07–8/14, all-in, incl. unbooked
 * Modal TTS — memory vater-cost-truth-automated):
 *   stills  $0.45 per finished minute (median; observed range $0.16–$0.55)
 *   motion  $2.70 per finished minute of ANIMATED runtime, on top of stills
 * The ops rate ($/finished minute) is config, never code — it is passed in
 * from lib/vater/billing/ops-fee.ts on the server and from
 * GET /api/vater/billing/rate in the browser.
 *
 * The DGX has an exact planner-driven version of this
 * (POST /vater/projects/{id}/estimate, feature contract 2026-08-16). When it
 * answers we use its numbers and stamp `source: "dgx"`; when it 404s — it is
 * shipping on a different lane — this local math answers instead and stamps
 * `source: "local"`. The shape is identical either way, so no caller has to
 * care which one it got.
 */

/**
 * QUOTE PACE — deliberately SLOWER than we actually narrate (Jared 2026-08-22:
 * "weighted heavy so that if it's cheaper they are happy").
 *
 * This was 185 ("Monroe's measured pace"), which turned out to be the fast
 * edge of the distribution rather than the middle. Measured across 26 finished
 * stills renders: median 170 wpm, p10 147, slowest 136. At 185 a 2,291-word
 * script quoted $9.91 while the same script actually bills ~$9.26 at the
 * median and up to $13.18 at the worst observed — i.e. roughly HALF of renders
 * came in ABOVE the number the customer was shown.
 *
 * 145 sits just under p10, so a script narrates FASTER than quoted ~9 times
 * out of 10, and the invoice lands under the estimate.
 *
 * ⚠️ A quote constant, not a fact about the voice. Anything that wants the real
 * pace (a runtime ETA, a P&L model) must measure, not read this.
 */
export const ESTIMATE_WORDS_PER_MINUTE = 145;

/**
 * QUOTE RATE for a finished minute of stills ($/min) — the WORST observed, not
 * the median (same 2026-08-22 change).
 *
 * Measured compute per finished minute across those 26 renders: p50 $0.337,
 * p90 $0.512, max $0.550. Quoting the median guarantees ~half of all invoices
 * exceed the quote. Quoting the max means the customer is over-quoted on a
 * typical render and surprised in the right direction.
 */
export const STILLS_USD_PER_MIN = 0.55;

/** Additional compute for a finished minute of ANIMATED video ($/min). */
export const MOTION_USD_PER_MIN = 2.7;

/** No estimate is ever quoted below this, so a 30-second test still reserves
 *  credit. Kept in step with MIN_ESTIMATE_USD in ledger.ts (which re-exports
 *  this constant rather than declaring a second one). */
export const MIN_ESTIMATE_USD = 1;

/**
 * Legacy name for STILLS_USD_PER_MIN. `estimateUsdFor()` in ledger.ts — the
 * number the budget gate reserves and the repair cap multiplies — has always
 * used the stills median, and changing what it reserves is a pricing decision,
 * not a refactor. Re-exported so that call site keeps reading the constant it
 * was written against.
 */
export const MEDIAN_COMPUTE_USD_PER_MIN = STILLS_USD_PER_MIN;

const r2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Words → billable whole minutes, the ONE conversion every money path uses.
 *
 * Before this existed the codebase had two: `quickEstimateUsd` divided by 185
 * (the engine card the customer reads) while `concierge-submit` divided by 150
 * and ceil'd (the ticket, the ledger reservation and the /hq operator view).
 * The same 2,291-word script therefore quoted $9.91 to the customer and
 * reserved $12.80 against their balance — the bug that started this.
 *
 * Ceil, because the ledger reserves and bills in whole planned minutes and a
 * partial minute still costs a full one's worth of setup.
 */
export function quoteMinutes(words: number): number {
  const w = Number(words);
  if (!Number.isFinite(w) || w <= 0) return 1;
  return Math.max(1, Math.ceil(w / ESTIMATE_WORDS_PER_MINUTE));
}

/**
 * Default ops rate ($/finished minute) when no env-backed rate is available —
 * mirrors DEFAULT_OPS_RATE in lib/vater/billing/ops-fee.ts, which is
 * server-only and cannot be imported here. If one changes, change both.
 */
export const DEFAULT_OPS_RATE_USD_PER_MIN = 0.35;

/**
 * One-number quick quote for a pasted script: stills compute + default ops
 * rate per finished minute, floored at MIN_ESTIMATE_USD. Client-safe. Used by
 * the Fable 5 Concierge engine card / ticket ("est. $X.XX") where there is no
 * project row yet to ask the DGX about. Same price as Auto by construction.
 */
export function quickEstimateUsd(words: number): number {
  const w = Number(words);
  if (!Number.isFinite(w) || w <= 0) return MIN_ESTIMATE_USD;
  const minutes = quoteMinutes(w);
  const usd = minutes * (MEDIAN_COMPUTE_USD_PER_MIN + DEFAULT_OPS_RATE_USD_PER_MIN);
  return r2(Math.max(MIN_ESTIMATE_USD, usd));
}

export interface EstimateBreakdown {
  /** Image generation + assembly, at cost. */
  stills: number;
  /** Text-to-speech, at cost. 0 from the local estimator — TTS is folded into
   *  the measured stills median rather than guessed at separately. */
  tts: number;
  /** The wan motion pass. 0 for a draft render. */
  motion: number;
  /** Finished minutes × the ops rate. */
  ops: number;
}

export interface RenderEstimate {
  /** Stills-only render, all in (compute + ops), floored at MIN_ESTIMATE_USD. */
  draftUsd: number;
  /** Fully animated render, all in. */
  fullUsd: number;
  /** The FULL render's breakdown — `motion` is what the draft leaves out. */
  breakdown: EstimateBreakdown;
  /** Planned finished runtime, in minutes. */
  minutes: number;
  /** Planned scene count, or 0 when nothing has been planned yet. */
  sceneCount: number;
  /** "dgx" = the planner's own numbers; "local" = this module's math. */
  source: "dgx" | "local";
}

/** Planned runtime in minutes, best available signal first. */
export function plannedMinutes(input: {
  /** Finished narration length — the only exact number, once it exists. */
  audioDuration?: number | null;
  /** Approved/draft script; word count ÷ 185 wpm. */
  scriptWords?: number | null;
  /** The user's requested length, in minutes. The weakest signal. */
  targetDuration?: number | null;
}): number {
  const audioMin = Number(input.audioDuration ?? 0) / 60;
  if (audioMin > 0) return audioMin;
  const words = Number(input.scriptWords ?? 0);
  if (words > 0) return words / ESTIMATE_WORDS_PER_MINUTE;
  return Math.max(0, Number(input.targetDuration ?? 0));
}

export interface LocalEstimateInput {
  minutes: number;
  sceneCount?: number;
  opsRatePerMinute: number;
  /**
   * Share of the runtime that gets the motion pass in a FULL render, 0–1.
   * Defaults to 1 (every scene animated). A project with `animUntilS` set is
   * a hybrid — only the opening window is animated — and passing the real
   * fraction stops us quoting a whole-video motion bill for it.
   */
  motionFraction?: number;
}

/**
 * The local estimate: planned minutes × published per-minute rates.
 *
 * Deliberately NOT scene-aware. Scene count drives image count, but the cost
 * that actually moves is per finished minute of runtime, and a per-scene
 * multiplier here would be an invented number of exactly the kind Model A was
 * killed for (memory: vater-billing-ops-fee).
 */
export function localEstimate(input: LocalEstimateInput): RenderEstimate {
  const minutes = Math.max(0, input.minutes);
  const motionFraction = Math.min(1, Math.max(0, input.motionFraction ?? 1));

  const stills = r2(minutes * STILLS_USD_PER_MIN);
  const motion = r2(minutes * motionFraction * MOTION_USD_PER_MIN);
  const ops = r2(minutes * Math.max(0, input.opsRatePerMinute));

  return {
    draftUsd: r2(Math.max(MIN_ESTIMATE_USD, stills + ops)),
    fullUsd: r2(Math.max(MIN_ESTIMATE_USD, stills + motion + ops)),
    breakdown: { stills, tts: 0, motion, ops },
    minutes: Math.round(minutes * 100) / 100,
    sceneCount: Math.max(0, Math.round(input.sceneCount ?? 0)),
    source: "local",
  };
}

/** Raw shape of POST /vater/projects/{id}/estimate (feature contract §DGX). */
export interface DgxEstimatePayload {
  stillsUsd?: number;
  motionUsd?: number;
  ttsUsd?: number;
  totalDraftUsd?: number;
  totalFullUsd?: number;
  minutes?: number;
  sceneCount?: number;
}

/**
 * Fold the DGX's compute-only estimate into ours by adding the ops line — the
 * DGX does not know the ops rate and must never be told to invent one.
 *
 * Returns null when the payload has no usable runtime, so the caller falls
 * back to the local estimate rather than quoting $0.
 */
export function fromDgxEstimate(
  payload: DgxEstimatePayload,
  opsRatePerMinute: number,
  motionFraction: number = 1,
): RenderEstimate | null {
  const minutes = Number(payload.minutes ?? 0);
  if (!Number.isFinite(minutes) || minutes <= 0) return null;

  const stills = r2(Number(payload.stillsUsd ?? 0));
  /* The DGX quotes motion for the WHOLE video — it is not told about the
   * opening window. A hybrid render animates only `animUntilS` and runs Ken
   * Burns after it, so the motion line is scaled here by the same fraction
   * `localEstimate` applies. Without this the parameter was computed and
   * discarded on the only branch that runs in production, and every hybrid
   * was quoted a whole-video motion bill. */
  const fraction = Math.min(1, Math.max(0, Number.isFinite(motionFraction) ? motionFraction : 1));
  const motion = r2(Number(payload.motionUsd ?? 0) * fraction);
  const tts = r2(Number(payload.ttsUsd ?? 0));
  const ops = r2(minutes * Math.max(0, opsRatePerMinute));

  const draftCompute = Number.isFinite(Number(payload.totalDraftUsd))
    ? Number(payload.totalDraftUsd)
    : stills + tts;
  /* `totalFullUsd` is the DGX's own whole-video total, so it cannot be used
   * once motion has been scaled — it would contradict the breakdown beside
   * it. Trust the payload's total only when nothing was scaled. */
  const fullCompute =
    fraction === 1 && Number.isFinite(Number(payload.totalFullUsd))
      ? Number(payload.totalFullUsd)
      : stills + tts + motion;

  return {
    draftUsd: r2(Math.max(MIN_ESTIMATE_USD, draftCompute + ops)),
    fullUsd: r2(Math.max(MIN_ESTIMATE_USD, fullCompute + ops)),
    breakdown: { stills, tts, motion, ops },
    minutes: Math.round(minutes * 100) / 100,
    sceneCount: Math.max(0, Math.round(Number(payload.sceneCount ?? 0))),
    source: "dgx",
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Planning calculator (the public pricing sliders)
// ─────────────────────────────────────────────────────────────────────────────

export interface PlanInput {
  videosPerMonth: number;
  minutesPerVideo: number;
  /** Share of scenes animated, 0–1. */
  motionShare: number;
  opsRatePerMinute: number;
}

export interface PlanEstimate {
  perVideoUsd: number;
  perMonthUsd: number;
  perMinuteUsd: number;
  breakdown: EstimateBreakdown;
}

/**
 * "≈ $X per video · $Y per month" for the landing-page calculator.
 *
 * Same rates as `localEstimate`, but NOT floored at $1: this is a planning
 * figure for a hypothetical video, and rounding a 1-minute stills clip up to
 * the reserve floor would overstate a month of them by several dollars.
 */
export function planEstimate(input: PlanInput): PlanEstimate {
  const minutes = Math.max(0, input.minutesPerVideo);
  const videos = Math.max(0, input.videosPerMonth);
  const motionShare = Math.min(1, Math.max(0, input.motionShare));

  const stills = minutes * STILLS_USD_PER_MIN;
  const motion = minutes * motionShare * MOTION_USD_PER_MIN;
  const ops = minutes * Math.max(0, input.opsRatePerMinute);
  const perVideo = stills + motion + ops;

  return {
    perVideoUsd: r2(perVideo),
    perMonthUsd: r2(perVideo * videos),
    perMinuteUsd: minutes > 0 ? r2(perVideo / minutes) : 0,
    breakdown: {
      stills: r2(stills),
      tts: 0,
      motion: r2(motion),
      ops: r2(ops),
    },
  };
}
