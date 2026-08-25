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
  "No fake progress bars — the chips move when a real stage does.";

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
