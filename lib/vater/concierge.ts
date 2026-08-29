/**
 * lib/vater/concierge.ts — Fable 5 Concierge, the SERVER half (2026-08-19).
 *
 * A concierge ticket is a human-directed render of a customer's own script:
 * the customer picks the "Fable 5" engine, the ticket lands on /hq, the
 * operator pastes the pack into Claude Code and `/fable5` drives the site's
 * own kickoff/sync/deliver routes. Same tenant style/voice/lane/billing as
 * Jelly Auto — only the direction is different.
 *
 * NO NEW TABLE, NO MIGRATION. The ticket lives on
 * `YouTubeProject.settingsJson = { ...features, engine: "fable5", concierge }`
 * and the project row gets one of three statuses (youtube-status.ts):
 *   concierge_queued | concierge_in_progress | concierge_needs_info
 * Delivered = `ready` (it IS a finished render), cancelled = `scripted`.
 *
 * `engine` / `concierge` are server-owned: PATCH /api/vater/youtube/[id]
 * rejects them and script-gate strips them from the DGX feature bag.
 *
 * The browser never imports this file — see concierge-client.ts.
 */
import "server-only";

import { createHash } from "node:crypto";
import type { Prisma, YouTubeProject } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { countWords } from "@/lib/vater/script-limits";
import { elevenLabsKeyMissing, ELEVENLABS_KEY_REQUIRED } from "@/lib/vater/elevenlabs-key-gate";
import { quoteMinutes } from "@/lib/vater/billing/estimate";
import {
  CONCIERGE_STATUSES,
  isConciergeStatus,
  type YouTubeProjectStatus,
} from "@/lib/vater/youtube-status";
import {
  isConciergeStage,
  readConciergeClient,
  readEngineClient,
  type ConciergeEngine,
  type ConciergeHistoryEntry,
  type ConciergeStage,
  type ConciergeTicketView,
} from "@/lib/vater/concierge-client";

export { CONCIERGE_STATUSES, isConciergeStatus };
export type { ConciergeEngine, ConciergeStage, ConciergeHistoryEntry, ConciergeTicketView };

/** Minimum script length for a ticket — same floor as /api/v1/videos. */
export const CONCIERGE_MIN_WORDS = 20;

/** History is append-only, capped so the JSON column can't grow unbounded. */
export const CONCIERGE_HISTORY_CAP = 30;

/** The authoritative ticket. `internalNote` NEVER leaves the server. */
export interface ConciergeTicket {
  v: 1;
  /** "F5-XXXXXX" — deterministic from the project id (ticketCodeFor). */
  code: string;
  userId: string;
  email: string;
  stage: ConciergeStage;
  submittedAt: string;
  claimedAt?: string | null;
  claimedBy?: string | null;
  deliveredAt?: string | null;
  cancelledAt?: string | null;
  /** DGX autopilot job id once kicked — the RENDER job (scene assets live here). */
  jobId?: string | null;
  /** Latest compose job (repair re-render). autopilotJobId is swapped to it
   *  while it runs; /sync re-points back to `jobId` once it is done so the
   *  /scene/[idx] proxy (Library artwork) keeps resolving. */
  composeJobId?: string | null;
  /** Customer-visible operator note (needs_info reason, delivery note). */
  operatorNote?: string | null;
  /** Operator-only scratch. Stripped by publicTicketView. */
  internalNote?: string | null;
  /** What the customer told us at submit. */
  customerNote?: string | null;
  words: number;
  estMinutes: number;
  estimateUsd: number;
  history: ConciergeHistoryEntry[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

export function wordCount(text: string | null | undefined): number {
  return countWords(text);
}

/** Crockford base32 — no I, L, O, U so a code survives being read aloud. */
const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

/**
 * "F5-" + 6 Crockford-base32 chars of sha256(projectId). Deterministic, so a
 * ticket can be re-derived from the project id and a stale pack still
 * points at the right row. 30 bits of the hash → 6 chars.
 */
export function ticketCodeFor(projectId: string): string {
  const digest = createHash("sha256").update(projectId, "utf8").digest();
  let bits = 0;
  let acc = 0;
  let out = "";
  for (let i = 0; out.length < 6 && i < digest.length; i++) {
    acc = (acc << 8) | digest[i];
    bits += 8;
    while (bits >= 5 && out.length < 6) {
      bits -= 5;
      out += CROCKFORD[(acc >> bits) & 31];
    }
    acc &= (1 << bits) - 1;
  }
  return `F5-${out}`;
}

/** Accepts "F5-ABC123", "f5-abc123", "abc123"; returns canonical or null. */
export function normalizeTicketCode(input: string | null | undefined): string | null {
  const raw = (input || "").trim().toUpperCase().replace(/^F5-?/, "");
  if (!/^[0-9A-HJKMNP-TV-Z]{6}$/.test(raw)) return null;
  return `F5-${raw}`;
}

function bag(settingsJson: unknown): Record<string, unknown> {
  return settingsJson && typeof settingsJson === "object" && !Array.isArray(settingsJson)
    ? (settingsJson as Record<string, unknown>)
    : {};
}

/** `settingsJson.engine` — "fable5" or "auto". */
export function readEngine(settingsJson: unknown): ConciergeEngine {
  return readEngineClient(settingsJson);
}

/** The full ticket (incl. internalNote) or null. */
export function readConcierge(settingsJson: unknown): ConciergeTicket | null {
  const view = readConciergeClient(settingsJson);
  if (!view) return null;
  const raw = bag(bag(settingsJson).concierge);
  return {
    ...view,
    internalNote: typeof raw.internalNote === "string" && raw.internalNote ? raw.internalNote : null,
  };
}

/** What a customer is allowed to see: everything but internalNote. */
export function publicTicketView(ticket: ConciergeTicket | null | undefined): ConciergeTicketView | null {
  if (!ticket) return null;
  const { internalNote: _internal, ...pub } = ticket;
  void _internal;
  return pub;
}

/** Stage → project status. Delivered is a real render (`ready`); cancelled
 *  leaves the approved script in place (`scripted`). */
export function stageToStatus(stage: ConciergeStage): YouTubeProjectStatus {
  switch (stage) {
    case "queued":
      return "concierge_queued";
    case "picked_up":
    case "directing":
    case "rendering":
    case "qa":
      return "concierge_in_progress";
    case "needs_info":
      return "concierge_needs_info";
    case "delivered":
      return "ready";
    case "cancelled":
      return "scripted";
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Read-modify-write on settingsJson
// ─────────────────────────────────────────────────────────────────────────────

export interface WriteConciergeOptions {
  /** Also set `YouTubeProject.status`. Pass `stageToStatus(stage)` or an explicit one. */
  status?: YouTubeProjectStatus;
  /** Extra columns to set in the same UPDATE (autopilotJobId, errorMessage, …). */
  extraData?: Omit<Prisma.YouTubeProjectUpdateInput, "settingsJson" | "status">;
  /** Who made the change, for the history line. */
  by?: string | null;
  /** Note for the history line (defaults to patch.operatorNote when the stage changes). */
  historyNote?: string | null;
  /** Force `engine` — defaults to "fable5" whenever a ticket is written. */
  engine?: ConciergeEngine | null;
}

/**
 * Transaction-safe read-modify-write of the ticket. Preserves every sibling
 * key in settingsJson (captions, overlays, brand kit …), appends a history
 * line when the stage changes (capped at CONCIERGE_HISTORY_CAP), and
 * optionally sets the project status + other columns in the same UPDATE.
 *
 * `patch` may be a partial ticket (existing ticket required) or a full ticket
 * (creates it). Setting a field to `null` clears it.
 */
/** Statuses whose autopilotJobId (if any) is the script-writing job, never a render. */
const SCRIPT_GATE_STATUSES: ReadonlySet<string> = new Set([
  "draft", "transcribed", "scripted", "awaiting_script_approval", "awaiting_engine", "expired",
]);

export async function writeConcierge(
  projectId: string,
  patch: Partial<ConciergeTicket>,
  opts: WriteConciergeOptions = {},
): Promise<{ project: YouTubeProject; ticket: ConciergeTicket }> {
  return prisma.$transaction(async (tx) => {
    const row = await tx.youTubeProject.findUnique({
      where: { id: projectId },
      select: { settingsJson: true, status: true },
    });
    if (!row) throw new Error(`concierge: project ${projectId} not found`);

    const current = bag(row.settingsJson);
    const existing = readConcierge(current);
    if (!existing && !(patch.code && patch.userId && patch.stage && patch.submittedAt)) {
      throw new Error(`concierge: project ${projectId} has no ticket and patch is not a full ticket`);
    }

    const nowIso = new Date().toISOString();
    const prevStage = existing?.stage ?? null;
    const merged: ConciergeTicket = {
      v: 1,
      code: patch.code ?? existing?.code ?? ticketCodeFor(projectId),
      userId: patch.userId ?? existing?.userId ?? "",
      email: patch.email ?? existing?.email ?? "",
      stage: patch.stage ?? existing?.stage ?? "queued",
      submittedAt: patch.submittedAt ?? existing?.submittedAt ?? nowIso,
      claimedAt: patch.claimedAt !== undefined ? patch.claimedAt : (existing?.claimedAt ?? null),
      claimedBy: patch.claimedBy !== undefined ? patch.claimedBy : (existing?.claimedBy ?? null),
      deliveredAt: patch.deliveredAt !== undefined ? patch.deliveredAt : (existing?.deliveredAt ?? null),
      cancelledAt: patch.cancelledAt !== undefined ? patch.cancelledAt : (existing?.cancelledAt ?? null),
      jobId: patch.jobId !== undefined ? patch.jobId : (existing?.jobId ?? null),
      composeJobId:
        patch.composeJobId !== undefined ? patch.composeJobId : (existing?.composeJobId ?? null),
      operatorNote:
        patch.operatorNote !== undefined ? patch.operatorNote : (existing?.operatorNote ?? null),
      internalNote:
        patch.internalNote !== undefined ? patch.internalNote : (existing?.internalNote ?? null),
      customerNote:
        patch.customerNote !== undefined ? patch.customerNote : (existing?.customerNote ?? null),
      words: patch.words ?? existing?.words ?? 0,
      estMinutes: patch.estMinutes ?? existing?.estMinutes ?? 0,
      estimateUsd: patch.estimateUsd ?? existing?.estimateUsd ?? 0,
      history: [...(patch.history ?? existing?.history ?? [])],
    };
    if (!isConciergeStage(merged.stage)) {
      throw new Error(`concierge: invalid stage ${String(merged.stage)}`);
    }

    // Auto-stamp the stage timestamps the caller didn't set explicitly.
    if (merged.stage !== prevStage) {
      if (merged.stage === "picked_up" && patch.claimedAt === undefined && !merged.claimedAt) {
        merged.claimedAt = nowIso;
      }
      if (merged.stage === "delivered" && patch.deliveredAt === undefined && !merged.deliveredAt) {
        merged.deliveredAt = nowIso;
      }
      if (merged.stage === "cancelled" && patch.cancelledAt === undefined && !merged.cancelledAt) {
        merged.cancelledAt = nowIso;
      }
      merged.history.push({
        at: nowIso,
        stage: merged.stage,
        by: opts.by ?? null,
        note: opts.historyNote ?? (patch.operatorNote !== undefined ? patch.operatorNote : null),
      });
    } else if (opts.historyNote) {
      merged.history.push({ at: nowIso, stage: merged.stage, by: opts.by ?? null, note: opts.historyNote });
    }
    if (merged.history.length > CONCIERGE_HISTORY_CAP) {
      merged.history = merged.history.slice(-CONCIERGE_HISTORY_CAP);
    }

    const nextBag: Record<string, unknown> = { ...current, concierge: merged };
    const engine = opts.engine === undefined ? "fable5" : opts.engine;
    if (engine === null) delete nextBag.engine;
    else nextBag.engine = engine;

    const project = await tx.youTubeProject.update({
      where: { id: projectId },
      data: {
        ...(opts.extraData ?? {}),
        settingsJson: nextBag as Prisma.InputJsonObject,
        ...(opts.status ? { status: opts.status } : {}),
        // Stepped flow (2026-08-28): a project arriving from the Review/Engine
        // steps still carries autopilotJobId = its FINISHED script job. The
        // fable5 CLI inherited that id and refused kickoff ("already has job"
        // — F5-90R097 parked for a human). A brand-new ticket on a row that
        // has not left the script gate owns no render job yet: clear it.
        ...(!existing && SCRIPT_GATE_STATUSES.has(row.status)
          ? { autopilotJobId: null }
          : {}),
      },
    });
    return { project, ticket: merged };
  });
}

/**
 * Drop the ticket + engine from settingsJson (customer cancel while queued).
 * Sibling keys survive. Optionally sets status (normally "scripted").
 */
export async function clearConcierge(
  projectId: string,
  opts: { status?: YouTubeProjectStatus } = {},
): Promise<YouTubeProject> {
  return prisma.$transaction(async (tx) => {
    const row = await tx.youTubeProject.findUnique({
      where: { id: projectId },
      select: { settingsJson: true },
    });
    const { engine: _e, concierge: _c, ...rest } = bag(row?.settingsJson);
    void _e;
    void _c;
    return tx.youTubeProject.update({
      where: { id: projectId },
      data: {
        settingsJson: rest as Prisma.InputJsonObject,
        ...(opts.status ? { status: opts.status } : {}),
      },
    });
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Lookup
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Find the project behind a ticket code OR a project id. Tries `findUnique`
 * by id first; otherwise a Postgres JSON-path filter on
 * `settingsJson.concierge.code` (the same filter shape lib/leads and lib/food
 * already use on this Prisma version). Delivered/cancelled tickets are found
 * too (include `ready`/`scripted`) so `/fable5 show` works after delivery —
 * callers that need a live ticket check `isConciergeStatus(project.status)`.
 */
export async function findTicketProject(
  codeOrProjectId: string,
): Promise<YouTubeProject | null> {
  const raw = (codeOrProjectId || "").trim();
  if (!raw) return null;

  const code = normalizeTicketCode(raw);
  if (!code || raw.length > 10) {
    const byId = await prisma.youTubeProject.findUnique({ where: { id: raw } });
    if (byId) return byId;
  }
  if (!code) return null;

  const live = Array.from(CONCIERGE_STATUSES);
  try {
    const rows = await prisma.youTubeProject.findMany({
      where: {
        settingsJson: { path: ["concierge", "code"], equals: code },
        status: { in: [...live, "ready", "scripted"] },
      },
      orderBy: { updatedAt: "desc" },
      take: 5,
    });
    return pickLiveFirst(rows);
  } catch {
    // JSON path filter unsupported on this engine → scan the concierge rows.
    const rows = await prisma.youTubeProject.findMany({
      where: { status: { in: [...live, "ready"] } },
      orderBy: { updatedAt: "desc" },
    });
    return pickLiveFirst(rows.filter((r) => readConcierge(r.settingsJson)?.code === code));
  }
}

function pickLiveFirst(rows: YouTubeProject[]): YouTubeProject | null {
  if (rows.length === 0) return null;
  return rows.find((r) => isConciergeStatus(r.status)) ?? rows[0];
}

// ─────────────────────────────────────────────────────────────────────────────
// Kickability — mirrors what script-gate.startRunCreation will refuse, so the
// submit route (and the operator's kickoff) can fail for free, before spend.
// ─────────────────────────────────────────────────────────────────────────────

export type KickableReason = "no_style" | "no_voice" | "no_script" | "no_elevenlabs_key";

export type KickableResult =
  | { ok: true }
  | { ok: false; reason: KickableReason; message: string };

type StyleForKick = {
  id: string;
  name: string;
  voice: string | null;
  voiceBackend: string | null;
} | null;

async function loadStyle(styleId: string | null | undefined): Promise<StyleForKick> {
  if (!styleId) return null;
  const s = await prisma.youTubeStyle.findUnique({
    where: { id: styleId },
    select: { id: true, name: true, voice: true, voiceBackend: true },
  });
  return s ?? null;
}

export async function isKickable(
  project: Pick<YouTubeProject, "id" | "userId" | "styleId" | "voiceName" | "script">,
): Promise<KickableResult> {
  if (wordCount(project.script) < CONCIERGE_MIN_WORDS) {
    return {
      ok: false,
      reason: "no_script",
      message: `Fable 5 renders a finished script — paste at least ${CONCIERGE_MIN_WORDS} words first.`,
    };
  }
  const style = await loadStyle(project.styleId);
  if (!style) {
    return {
      ok: false,
      reason: "no_style",
      message: "Pick a style first — Fable 5 directs in YOUR style (characters, art direction, voice).",
    };
  }
  const voice = project.voiceName || style.voice;
  if (!voice) {
    return {
      ok: false,
      reason: "no_voice",
      message: "Project has no voice — pick a voice (or a style that sets one) first",
    };
  }
  // Same rule as script-gate: a project-level voice override is always a local
  // clone, which drops ElevenLabs routing. Only a style-voiced EL render needs
  // the customer's own key.
  const projectVoiceOverride = !!project.voiceName && project.voiceName !== style.voice;
  if (
    !projectVoiceOverride &&
    style.voiceBackend === "elevenlabs" &&
    (await elevenLabsKeyMissing(project.userId))
  ) {
    return { ok: false, reason: "no_elevenlabs_key", message: ELEVENLABS_KEY_REQUIRED };
  }
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// Operator pack — the text /hq copies to the clipboard and the CLI prints.
// FIXED FORMAT (plan C3) — both surfaces must agree byte-for-byte.
// ─────────────────────────────────────────────────────────────────────────────

export interface PackOwner {
  userId: string;
  email: string | null | undefined;
  /** "jelly" (customer) | "vater" (house). */
  lane: string;
  /** "owner" | "beta" | any tier label the queue route resolved. */
  tier: string;
}

export interface PackProject
  extends Pick<
    YouTubeProject,
    "id" | "sourceTitle" | "topic" | "script" | "styleId" | "voiceName" | "settingsJson"
  > {
  /** Pass the joined style row when you have it; otherwise it is looked up. */
  style?: { id: string; name: string; voice: string | null; voiceBackend: string | null } | null;
}

function packVoice(project: PackProject, style: StyleForKick): { name: string; backend: string } {
  if (project.voiceName && project.voiceName !== style?.voice) {
    // Project override = local clone; script-gate demotes EL routing to indextts-modal.
    const backend = style?.voiceBackend === "elevenlabs" ? "indextts-modal" : style?.voiceBackend || "local";
    return { name: project.voiceName, backend };
  }
  return { name: style?.voice || project.voiceName || "—", backend: style?.voiceBackend || "—" };
}

/**
 * ### FABLE5 TICKET F5-XXXXXX · project <projectId> · owner <email> (<userId>) · lane <jelly|vater> · words N
 * title: … | style: <name> (<styleId>) | voice: <voiceName> [<backend>] | tier: <tier> | est: $X.XX (~N min) | submitted: <ISO> | stage: <stage>
 * customer note: … (or —)
 * --- SCRIPT ---
 * <script verbatim>
 */
export async function buildPackText(project: PackProject, owner: PackOwner): Promise<string> {
  const ticket = readConcierge(project.settingsJson);
  const style = project.style !== undefined ? project.style : await loadStyle(project.styleId);
  const script = project.script ?? "";
  const words = ticket?.words || wordCount(script);
  const voice = packVoice(project, style);
  const title = (project.sourceTitle || project.topic || "Untitled").replace(/\s*\n+\s*/g, " ").trim();
  const code = ticket?.code ?? ticketCodeFor(project.id);
  const est = ticket?.estimateUsd ?? 0;
  const estMin = ticket?.estMinutes ?? quoteMinutes(words);
  const note = (ticket?.customerNote || "").replace(/\s*\n+\s*/g, " ").trim() || "—";
  return [
    `### FABLE5 TICKET ${code} · project ${project.id} · owner ${owner.email || "—"} (${owner.userId}) · lane ${owner.lane} · words ${words}`,
    `title: ${title} | style: ${style?.name ?? "—"} (${project.styleId ?? "—"}) | voice: ${voice.name} [${voice.backend}] | tier: ${owner.tier} | est: $${est.toFixed(2)} (~${estMin} min) | submitted: ${ticket?.submittedAt ?? "—"} | stage: ${ticket?.stage ?? "—"}`,
    `customer note: ${note}`,
    `--- SCRIPT ---`,
    script,
  ].join("\n");
}
