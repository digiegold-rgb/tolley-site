/**
 * Stepped create flow — the single source of truth for "which step is this
 * project on" (2026-08-28).
 *
 * Shared by the CreateScreen stepper, the Progress tab, the sidebar badge,
 * the progress-summary route and the email/push deep links. Pure + client
 * safe: no Prisma, no React.
 *
 * Numbering is the customer-facing one (Jared 8/28) — never renumber:
 *   1 Source · 2 Transcript · 3 Length · 4 Writing… · 5 Review script
 *   6 Choose engine · 7 Producing… · 8 Done
 *
 * `flowStep` on YouTubeProject records the last step the USER reached on
 * the input steps (1–3). Once the machine moves, `status` wins — a row in
 * `scripting` is on step 4 no matter what flowStep says.
 */

import { CONCIERGE_STATUSES, IN_FLIGHT_STATUSES } from "./youtube-status";
import { isStuckBeforeReadyStatus, rowLooksFileReady, type DeliveryRow } from "./delivery-ready";

export type CreateStepId =
  | "source"
  | "transcript"
  | "length"
  | "writing"
  | "review"
  | "engine"
  | "producing"
  | "done";

/**
 * input    — the customer is filling something in (1–3)
 * async    — the machine is working; sidebar pulses (4, 7)
 * approval — waiting on a free customer decision; badge counts it (5)
 * money    — waiting on the one paid click; badge counts it (6)
 * terminal — nothing left to do (8)
 * failed   — the step it died in; badge counts it (any)
 * expired  — approval gate sat 7 days; reopen to continue (5/6)
 */
export type CreateStepKind =
  | "input"
  | "async"
  | "approval"
  | "money"
  | "terminal"
  | "failed"
  | "expired";

export interface CreateStepDef {
  n: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
  id: CreateStepId;
  label: string;
  /** Short line under the label in the stepper rail. */
  hint: string;
}

export const CREATE_STEPS: readonly CreateStepDef[] = [
  { n: 1, id: "source", label: "Source", hint: "YouTube link, your script, or a topic" },
  { n: 2, id: "transcript", label: "Transcript", hint: "Pulled from the video" },
  { n: 3, id: "length", label: "Length", hint: "Minutes and word count" },
  { n: 4, id: "writing", label: "Writing", hint: "Pick a model, then write or edit" },
  { n: 5, id: "review", label: "Review script", hint: "Approve, edit, or generate again" },
  { n: 6, id: "engine", label: "Choose engine", hint: "Jelly or Fable — the paid step" },
  { n: 7, id: "producing", label: "Producing", hint: "Voice, scenes, video" },
  { n: 8, id: "done", label: "Done", hint: "In your Library" },
];

export const CREATE_STEP_COUNT = 8;

export function stepDef(n: number): CreateStepDef {
  return CREATE_STEPS[Math.min(Math.max(1, Math.round(n)), CREATE_STEP_COUNT) - 1];
}

/** The subset of a YouTubeProject row the derivation needs. */
export interface CreateStepInput extends DeliveryRow {
  status?: string | null;
  flowStep?: number | null;
  transcript?: string | null;
  script?: string | null;
  scriptApprovedAt?: Date | string | null;
  approvalExpiresAt?: Date | string | null;
  finalVideoUrl?: string | null;
  /** DGX `stepDetails` / failure phase, used to place a `failed` row. */
  failedPhase?: string | null;
  /** Fable 5 concierge stage when the row is on that lane. */
  conciergeStage?: string | null;
}

export interface DerivedCreateStep {
  step: CreateStepDef["n"];
  kind: CreateStepKind;
  /** True when the badge should count this row (approval | money | failed). */
  needsUser: boolean;
  /** True when the sidebar should pulse for this row (async). */
  active: boolean;
}

const STEP7_STATUSES = new Set([
  "generating_audio",
  "aligning_captions",
  "generating_scenes",
  "composing_video",
  "editing",
  "concierge_queued",
  "concierge_in_progress",
]);

const STEP4_STATUSES = new Set([
  "queued",
  "extracting_principles",
  "scripting",
  "verifying",
  "awaiting_context",
]);

const STEP2_STATUSES = new Set(["fetching", "transcribing", "transcribed"]);

/** Phase names the DGX reports on failure → the step the customer sees. */
const FAILED_PHASE_STEP: Record<string, CreateStepDef["n"]> = {
  fetch: 2,
  transcribe: 2,
  principles: 4,
  script: 4,
  verify: 4,
  voice: 7,
  captions: 7,
  scenes: 7,
  compose: 7,
};

function isPast(d: Date | string | null | undefined, now: number): boolean {
  if (!d) return false;
  const t = typeof d === "string" ? Date.parse(d) : d.getTime();
  return Number.isFinite(t) && t < now;
}

function make(step: CreateStepDef["n"], kind: CreateStepKind): DerivedCreateStep {
  return {
    step,
    kind,
    needsUser: kind === "approval" || kind === "money" || kind === "failed" || kind === "expired",
    active: kind === "async",
  };
}

/**
 * Where is this project in the 8-step flow?
 *
 * Server status beats `flowStep` once the machine has moved; on the input
 * steps (draft/transcribed) `flowStep` is the last step the user reached,
 * clamped to what the row can actually support (no transcript → step 1).
 */
export function deriveCreateStep(
  p: CreateStepInput,
  now: number = Date.now(),
): DerivedCreateStep {
  const status = p.status ?? "draft";
  const flow = Math.min(Math.max(1, p.flowStep ?? 1), CREATE_STEP_COUNT);

  if (status === "ready") return make(8, "terminal");
  // Finished stitch + final mp4 is Done even if status was left on
  // concierge_in_progress / producing (#66). Audit-missing is not a gate.
  if (isStuckBeforeReadyStatus(status) && rowLooksFileReady(p)) {
    return make(8, "terminal");
  }
  if (status === "expired") {
    // An expired gate is shown on the step it was waiting on.
    return make(p.scriptApprovedAt ? 6 : 5, "expired");
  }
  if (status === "failed") {
    const phase = (p.failedPhase ?? "").toLowerCase();
    const hit = Object.keys(FAILED_PHASE_STEP).find((k) => phase.includes(k));
    if (hit) return make(FAILED_PHASE_STEP[hit], "failed");
    // No phase: guess from what the row has.
    if (p.scriptApprovedAt) return make(7, "failed");
    if (p.script) return make(4, "failed");
    return make(p.transcript ? 4 : 2, "failed");
  }
  if (status === "awaiting_engine") {
    return isPast(p.approvalExpiresAt, now) ? make(6, "expired") : make(6, "money");
  }
  if (status === "awaiting_script_approval" || status === "concierge_needs_info") {
    return isPast(p.approvalExpiresAt, now) ? make(5, "expired") : make(5, "approval");
  }
  if (status === "scripted") {
    // Legacy: `scripted` without an approval stamp = still needs review;
    // with one = the render kick is in flight (old combined route) → 7.
    return p.scriptApprovedAt ? make(7, "async") : make(5, "approval");
  }
  if (STEP7_STATUSES.has(status)) return make(7, "async");
  if (STEP4_STATUSES.has(status)) return make(4, "async");
  if (STEP2_STATUSES.has(status)) {
    if (status === "transcribed" || p.transcript) {
      // Pasted/edited a script and continued — same Review gate as a generate.
      if (flow >= 5 && p.script) return make(5, "approval");
      // Length confirmed → the on-site writer (step 4), not a DGX spinner.
      if (flow >= 4) return make(4, "input");
      return flow >= 3 ? make(3, "input") : make(2, "input");
    }
    return make(2, "async");
  }
  // draft (or unknown): the user's last input step, clamped by data present.
  // Own-script and generate-from-video both land on the Writing editor (4)
  // with the same controls; Review (5) is approve + iterate.
  if (p.script && !p.scriptApprovedAt) {
    if (flow >= 5) return make(5, "approval");
    if (flow >= 4) return make(4, "input");
  }
  if (!p.transcript) return make(1, "input");
  if (flow >= 4) return make(4, "input");
  return flow >= 3 ? make(3, "input") : make(2, "input");
}

/** `#r=create&p=<id>&s=<n>` — the hash the Shell router understands. */
export function stepHash(projectId: string, step: number): string {
  return `#r=create&p=${encodeURIComponent(projectId)}&s=${stepDef(step).n}`;
}

/** Absolute deep link for email / push. */
export function stepUrl(projectId: string, step: number): string {
  return `https://www.tolley.io/animate${stepHash(projectId, step)}`;
}

/** Statuses the Progress tab treats as "In progress" (pulse). */
export function isActiveStatus(status: string | null | undefined): boolean {
  if (!status) return false;
  if (status === "editing") return true;
  if (IN_FLIGHT_STATUSES.has(status as never)) return true;
  if (CONCIERGE_STATUSES.has(status as never)) return status !== "concierge_needs_info";
  return false;
}

/** The 5 "make it more different" directives; the server picks one by seed. */
export const VARIATION_DIRECTIVES = [
  "hook_style",
  "opening_scene",
  "pov",
  "pacing_template",
  "section_order",
] as const;
export type VariationDirective = (typeof VARIATION_DIRECTIVES)[number];

export const VARIATION_DIRECTIVE_LABELS: Record<VariationDirective, string> = {
  hook_style: "Different hook",
  opening_scene: "Different opening scene",
  pov: "Different point of view",
  pacing_template: "Different pacing",
  section_order: "Different section order",
};

/** Shape persisted on `YouTubeProject.variationJson` by POST [id]/rewrite. */
export interface VariationJson {
  count: number;
  seed: number;
  directive: VariationDirective;
  requestedAt: string;
}

/** Approval gates expire after 7 days (Jared 8/28). */
export const APPROVAL_TTL_MS = 7 * 24 * 60 * 60 * 1000;
