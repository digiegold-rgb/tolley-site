/**
 * lib/vater/concierge-client.ts — Fable 5 Concierge, the CLIENT-SAFE half.
 *
 * ⚠️ ZERO SERVER IMPORTS. This is imported by the editor (ConciergeStatusCard,
 * ProjectShell, Queue, Dashboard) so it must stay free of prisma / node / the
 * autopilot client. Everything that touches the database lives in
 * lib/vater/concierge.ts (server-only) — the ticket SHAPE is declared there;
 * this file re-declares the public projection with permissive parsing because
 * the browser reads whatever `GET /api/vater/youtube/[id]` hands it.
 *
 * Ticket home: `YouTubeProject.settingsJson = { ...features, engine, concierge }`.
 */

export type ConciergeEngine = "auto" | "fable5";

export type ConciergeStage =
  | "queued"
  | "picked_up"
  | "directing"
  | "rendering"
  | "qa"
  | "delivered"
  | "needs_info"
  | "cancelled";

export const CONCIERGE_STAGES: readonly ConciergeStage[] = [
  "queued",
  "picked_up",
  "directing",
  "rendering",
  "qa",
  "delivered",
  "needs_info",
  "cancelled",
] as const;

export function isConciergeStage(v: unknown): v is ConciergeStage {
  return typeof v === "string" && (CONCIERGE_STAGES as readonly string[]).includes(v);
}

/** One line of ticket history (capped at 30 on the server). */
export interface ConciergeHistoryEntry {
  at: string;
  stage: ConciergeStage;
  by?: string | null;
  note?: string | null;
}

/**
 * The latest delivery audit (fable5-audit.py → POST /api/vater/concierge/
 * [ticket]/audit). 2026-08-28: F5-B0A50J was delivered 24 s BEFORE its audit
 * ran (29/34 hard fails) because the audit only lived on the DGX. This is
 * the site-side copy the deliver route gates on and the /hq board shows.
 */
export interface ConciergeAudit {
  round: number;
  /** "r1" (render stills) | "final" (frames pulled from the final video). */
  source: string;
  at: string;
  /** `?v=` of the final the audit judged (source=final), else null. */
  finalV: string | null;
  finalVideoUrl: string | null;
  jobId: string | null;
  hardFails: number;
  sceneCount: number;
  judged: number;
  byCheck: Record<string, number>;
  /** 1-based scene numbers with a hard failure. */
  hardScenes: number[];
  costUsd: number;
  rulesVersion: string | null;
  reportUrl: string | null;
  /** hardFails === 0 && judged >= sceneCount — computed on the server. */
  passed: boolean;
}

export const AUDIT_MAX_LIST = 500;
export const AUDIT_MAX_CHECKS = 40;
export const AUDIT_MAX_URL = 500;

const finiteNum = (v: unknown, d = 0): number => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : d;
};

/**
 * Permissive/clipping reader for an audit dict — used both for the stored
 * ticket (readConciergeClient) and for the raw POST body of the /audit route.
 * `passed` is ALWAYS recomputed from the numbers, never trusted from input.
 * null when the input is not an object or has no usable `round`.
 */
export function parseConciergeAudit(raw: unknown): ConciergeAudit | null {
  const a = bag(raw);
  if (!a) return null;
  const round = Math.trunc(finiteNum(a.round, NaN));
  if (!Number.isFinite(round) || round < 1) return null;
  const hardFails = Math.max(0, Math.trunc(finiteNum(a.hardFails)));
  const sceneCount = Math.max(0, Math.trunc(finiteNum(a.sceneCount)));
  const judged = Math.max(0, Math.trunc(finiteNum(a.judged)));
  const byCheck: Record<string, number> = {};
  const rawChecks = bag(a.byCheck);
  if (rawChecks) {
    for (const [k, v] of Object.entries(rawChecks).slice(0, AUDIT_MAX_CHECKS)) {
      const n = finiteNum(v, NaN);
      if (k && Number.isFinite(n)) byCheck[k.slice(0, 40)] = Math.trunc(n);
    }
  }
  const hardScenes = Array.isArray(a.hardScenes)
    ? (a.hardScenes as unknown[])
        .map((v) => Math.trunc(finiteNum(v, NaN)))
        .filter((n) => Number.isFinite(n))
        .slice(0, AUDIT_MAX_LIST)
    : [];
  // fable5-audit.py writes rulesVersion as {version,count,source,…}; store the version string.
  const rv = a.rulesVersion;
  const rulesVersion =
    typeof rv === "string" && rv
      ? rv.slice(0, 40)
      : typeof rv === "number"
        ? String(rv)
        : bag(rv)?.version != null && String(bag(rv)!.version)
          ? String(bag(rv)!.version).slice(0, 40)
          : null;
  const finalV = a.finalV == null ? null : String(a.finalV).slice(0, 40) || null;
  const reportUrl =
    typeof a.reportUrl === "string" && /^https?:\/\//.test(a.reportUrl)
      ? a.reportUrl.slice(0, AUDIT_MAX_URL)
      : null;
  return {
    round,
    source: (str(a.source) ?? "r1").slice(0, 16),
    at: str(a.at) ?? new Date().toISOString(),
    finalV,
    finalVideoUrl: str(a.finalVideoUrl)?.slice(0, AUDIT_MAX_URL) ?? null,
    jobId: str(a.jobId)?.slice(0, 64) ?? null,
    hardFails,
    sceneCount,
    judged,
    byCheck,
    hardScenes,
    costUsd: Math.round(finiteNum(a.costUsd) * 10000) / 10000,
    rulesVersion,
    reportUrl,
    passed: hardFails === 0 && judged >= sceneCount,
  };
}

/** `?v=` of a finalVideoUrl (the cache-buster the sync writes), or null. */
export function finalVersionOf(finalVideoUrl: string | null | undefined): string | null {
  const m = /[?&]v=([^&#]+)/.exec(finalVideoUrl ?? "");
  return m ? m[1] : null;
}

export interface AuditMatchTarget {
  finalVideoUrl: string | null | undefined;
  /** ticket.jobId — the RENDER job. */
  jobId?: string | null;
  /** ticket.composeJobId — set once a repair compose has ever run. */
  composeJobId?: string | null;
}

/**
 * Does this audit speak for the final the project currently holds?
 *   - source=final: its `finalV` equals the final's `?v=`, or its
 *     `finalVideoUrl` equals the row's finalVideoUrl verbatim;
 *   - source=r1 (stills of the render job, no final refs): only while the
 *     final IS the plain compose of those stills — same render job and no
 *     repair compose has ever run. Any compose after an r1 audit needs a
 *     fresh `--source final` round.
 */
export function auditMatchesFinal(audit: ConciergeAudit | null | undefined, target: AuditMatchTarget): boolean {
  if (!audit || !target.finalVideoUrl) return false;
  const v = finalVersionOf(target.finalVideoUrl);
  if (audit.finalV && v && audit.finalV === v) return true;
  if (audit.finalVideoUrl && audit.finalVideoUrl === target.finalVideoUrl) return true;
  if (audit.finalV || audit.finalVideoUrl) return false;
  return (
    audit.source === "r1" &&
    !!audit.jobId &&
    !!target.jobId &&
    audit.jobId === target.jobId &&
    !target.composeJobId
  );
}

/** Short chip text: "no audit yet" · "audit r2 PASS" · "audit r1 FAIL 29/34". */
export function auditChipLabel(audit: ConciergeAudit | null | undefined): string {
  if (!audit) return "no audit yet";
  return audit.passed
    ? `audit r${audit.round} PASS`
    : `audit r${audit.round} FAIL ${audit.hardFails}/${audit.sceneCount}`;
}

/**
 * What the browser sees. Same fields as the server `ConciergeTicket` MINUS
 * `internalNote`, which `publicTicketView` strips before it leaves the server.
 */
export interface ConciergeTicketView {
  v: 1;
  code: string;
  userId: string;
  email: string;
  stage: ConciergeStage;
  submittedAt: string;
  claimedAt?: string | null;
  claimedBy?: string | null;
  deliveredAt?: string | null;
  cancelledAt?: string | null;
  jobId?: string | null;
  /** Latest compose (repair) job — see server ConciergeTicket. */
  composeJobId?: string | null;
  /** Customer-visible note from the operator (needs_info reason, delivery note). */
  operatorNote?: string | null;
  /** What the customer told us at submit. */
  customerNote?: string | null;
  words: number;
  estMinutes: number;
  estimateUsd: number;
  history: ConciergeHistoryEntry[];
  /** Latest delivery audit posted by fable5-audit.py (null until it runs). */
  audit?: ConciergeAudit | null;
}

function bag(settingsJson: unknown): Record<string, unknown> | null {
  return settingsJson && typeof settingsJson === "object" && !Array.isArray(settingsJson)
    ? (settingsJson as Record<string, unknown>)
    : null;
}

const str = (v: unknown): string | null => (typeof v === "string" && v ? v : null);
const num = (v: unknown, d = 0): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};

/** `settingsJson.engine` — "fable5" for a concierge project, "auto" otherwise. */
export function readEngineClient(settingsJson: unknown): ConciergeEngine {
  return bag(settingsJson)?.engine === "fable5" ? "fable5" : "auto";
}

/** Permissive reader for the ticket the API returned. null when absent/garbled. */
export function readConciergeClient(settingsJson: unknown): ConciergeTicketView | null {
  const raw = bag(settingsJson)?.concierge;
  const t = bag(raw);
  if (!t) return null;
  const code = str(t.code);
  const stage = t.stage;
  if (!code || !isConciergeStage(stage)) return null;
  const history = Array.isArray(t.history)
    ? (t.history as unknown[])
        .map((h) => bag(h))
        .filter((h): h is Record<string, unknown> => !!h && isConciergeStage(h.stage))
        .map((h) => ({
          at: str(h.at) ?? "",
          stage: h.stage as ConciergeStage,
          by: str(h.by),
          note: str(h.note),
        }))
    : [];
  return {
    v: 1,
    code,
    userId: str(t.userId) ?? "",
    email: str(t.email) ?? "",
    stage,
    submittedAt: str(t.submittedAt) ?? "",
    claimedAt: str(t.claimedAt),
    claimedBy: str(t.claimedBy),
    deliveredAt: str(t.deliveredAt),
    cancelledAt: str(t.cancelledAt),
    jobId: str(t.jobId),
    composeJobId: str(t.composeJobId),
    operatorNote: str(t.operatorNote),
    customerNote: str(t.customerNote),
    words: num(t.words),
    estMinutes: num(t.estMinutes),
    estimateUsd: num(t.estimateUsd),
    history,
    audit: parseConciergeAudit(t.audit),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Copy. The status card shows stage CHIPS that move when a real stage does —
// never a fake percentage.
// ─────────────────────────────────────────────────────────────────────────────

/** The happy-path chips, in order. needs_info / cancelled are off-path states. */
export const CONCIERGE_STAGE_CHIPS: ReadonlyArray<{ stage: ConciergeStage; label: string }> = [
  { stage: "queued", label: "Queued" },
  { stage: "picked_up", label: "Picked up" },
  { stage: "directing", label: "Directing" },
  { stage: "rendering", label: "Rendering" },
  { stage: "qa", label: "Quality check" },
  { stage: "delivered", label: "Delivered" },
] as const;

/** Index of a stage on the chip rail (-1 for needs_info / cancelled). */
export function conciergeChipIndex(stage: ConciergeStage): number {
  return CONCIERGE_STAGE_CHIPS.findIndex((c) => c.stage === stage);
}

export function conciergeHeadline(stage: ConciergeStage): string {
  switch (stage) {
    case "queued":
      return "Fable 5 has your script.";
    case "picked_up":
      return "Fable 5 picked up your ticket.";
    case "directing":
      return "Fable 5 is directing your video in the Jelly studio.";
    case "rendering":
      return "Rendering — the studio is producing your video.";
    case "qa":
      return "Quality check — a person is watching it before you do.";
    case "needs_info":
      return "Fable 5 needs one thing from you.";
    case "delivered":
      return "Delivered — it's in your Library.";
    case "cancelled":
      return "Ticket cancelled — your script is untouched.";
  }
}

export const CONCIERGE_SUBCOPY =
  "Typical turnaround is a few hours, up to ~24h while we're in beta. " +
  "No fake progress bars — the chips move when a real stage does. " +
  "The amount above is reserved, not charged: your final price lands between the " +
  "estimate you saw when you picked the engine and this reserve — you're billed the actual cost.";

/** "What happens next" — four lines under the chips. */
export const CONCIERGE_NEXT_STEPS: readonly string[] = [
  "Fable 5 reads your script and directs every scene in your own style and voice.",
  "The studio renders it, then a person watches it before you do.",
  "It lands in your Library and you get an email — same place Auto renders go.",
  "Billed only when it lands — same price as Auto; failed renders are never charged.",
] as const;

/** Engine card blurbs (EnginePicker). */
export const CONCIERGE_ENGINE_COPY = {
  auto: {
    name: "Jelly Auto",
    blurb: "Renders now on the Jelly pipeline. Usually 10–30 minutes.",
  },
  fable5: {
    name: "Fable 5 Concierge",
    badge: "beta",
    blurb:
      "Fable 5 directs your script itself in the Jelly studio — plans every scene in your style, renders, " +
      "reviews the frames and fixes what the pipeline gets wrong, then delivers to your Library and emails you. " +
      "Same price as Auto — billed only when the finished video lands. Typically 1–3 hours (longer scripts take longer). Needs a finished script.",
  },
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Relative time
// ─────────────────────────────────────────────────────────────────────────────

/** "just now" · "14 min ago" · "3 h ago" · "2 d ago" — "" for a bad date. */
export function relativeTimeLabel(iso: string | Date | null | undefined, now: number = Date.now()): string {
  if (!iso) return "";
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "";
  const s = Math.max(0, Math.round((now - t) / 1000));
  if (s < 45) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h} h ago`;
  const d = Math.round(h / 24);
  return `${d} d ago`;
}

/** "queued 14 min ago" — verb + relative time, for the status card footer. */
export function ticketAgeLabel(
  iso: string | Date | null | undefined,
  verb: string = "queued",
  now: number = Date.now(),
): string {
  const rel = relativeTimeLabel(iso, now);
  return rel ? `${verb} ${rel}` : verb;
}
