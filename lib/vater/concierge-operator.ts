/**
 * lib/vater/concierge-operator.ts — shared plumbing for the operator routes
 * under `app/api/vater/concierge/` (Phase C). Server-only.
 *
 *   - `loadTicketProject(param)`  → project + ticket, or a 404 response
 *   - `resolveOwner(userId)`      → email/name/tier/lane/unmetered/balance/maxWords
 *   - `ticketSummary(...)`        → the queue/ticket JSON shape the CLI reads
 *   - `conciergeTelegram(...)`    → best-effort Telegram (Markdown-safe)
 *   - `editorUrlFor(projectId)`   → deep link used in needs_info emails
 *
 * The HTTP contract these helpers serve is fixed — the DGX CLI
 * (`~/vater-studio/fable5/fable5.mjs`) is written against it. Change shapes
 * here and the CLI must change with them.
 */
import "server-only";

import type { YouTubeProject } from "@prisma/client";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { resolveVaterTier } from "@/lib/admin-auth";
import { getBalance } from "@/lib/vater/billing/ledger";
import { maxWordsFor } from "@/lib/vater/billing/script-cap";
import { notifyTelegram } from "@/lib/budget/notify";
import { parseVideoCost } from "@/lib/vater/video-cost";
import {
  findTicketProject,
  readConcierge,
  type ConciergeTicket,
} from "@/lib/vater/concierge";

export const CONCIERGE_LIBRARY_URL = "https://www.tolley.io/animate#r=library";

export function editorUrlFor(projectId: string): string {
  return `https://www.tolley.io/animate#r=editor&p=${encodeURIComponent(projectId)}`;
}

/** Telegram parse_mode is Markdown — unbalanced _ * ` [ ] 400s the send. */
export function tgSafe(v: string | null | undefined): string {
  return (v ?? "").replace(/[_*`[\]]/g, "");
}

/** Best-effort Telegram — never throws, never blocks the response. */
export async function conciergeTelegram(text: string): Promise<void> {
  try {
    const r = await notifyTelegram(text);
    if (!r.ok) console.warn("[concierge] telegram:", r.error);
  } catch (err) {
    console.warn("[concierge] telegram threw:", err);
  }
}

export function jsonError(status: number, error: string, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ error, ...extra }, { status });
}

/** Parse a JSON body; `{}` on empty body (most operator POSTs are optional-body). */
export async function readBody<T extends object>(req: Request): Promise<T | null> {
  const text = await req.text();
  if (!text.trim()) return {} as T;
  try {
    const v = JSON.parse(text);
    return v && typeof v === "object" && !Array.isArray(v) ? (v as T) : null;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Ticket lookup
// ─────────────────────────────────────────────────────────────────────────────

export type LoadedTicket = { project: YouTubeProject; ticket: ConciergeTicket };

/** `[ticket]` segment → project row + ticket, or a 404 JSON response. */
export async function loadTicketProject(
  param: string,
): Promise<LoadedTicket | { response: NextResponse }> {
  const project = await findTicketProject(decodeURIComponent(param || ""));
  if (!project) {
    return { response: jsonError(404, "ticket not found", { code: "not_found" }) };
  }
  const ticket = readConcierge(project.settingsJson);
  if (!ticket) {
    return {
      response: jsonError(404, "project has no Fable 5 ticket", { code: "not_found" }),
    };
  }
  return { project, ticket };
}

// ─────────────────────────────────────────────────────────────────────────────
// Owner enrichment
// ─────────────────────────────────────────────────────────────────────────────

export interface OwnerInfo {
  userId: string;
  email: string | null;
  name: string | null;
  /** "public" | "studio" | "owner" (lib/admin-auth resolveVaterTier). */
  tier: string;
  /** Which Modal app family / invoice line: "vater" (house) | "jelly" (customer). */
  lane: "vater" | "jelly";
  unmetered: boolean;
  /** Spendable credit in dollars; null when unmetered or the ledger is not live. */
  balanceUsd: number | null;
  /** Script cap in words; null = uncapped (owner). JSON cannot carry Infinity. */
  maxWords: number | null;
}

/**
 * Same decisions as lib/vater/owner-tier.ts `laneFor` (lane follows
 * UNMETERED, never the tier — Trey is studio-not-admin) and
 * lib/vater/billing/script-cap.ts. One User lookup + tier + (balance) per
 * distinct user; the queue route calls this once per group.
 */
export async function resolveOwner(userId: string | null | undefined): Promise<OwnerInfo> {
  if (!userId) {
    // Legacy pre-tenancy row = the house's by definition (owner-tier.ts).
    return {
      userId: "",
      email: null,
      name: null,
      tier: "owner",
      lane: "vater",
      unmetered: true,
      balanceUsd: null,
      maxWords: null,
    };
  }
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, name: true },
  });
  const email = user?.email ?? null;
  const access = await resolveVaterTier(userId, email);
  const unmetered = access.unmetered;
  let balanceUsd: number | null = null;
  if (!unmetered) {
    try {
      const b = await getBalance(userId);
      balanceUsd = b.ready ? Math.round(b.balanceCents) / 100 : null;
    } catch (err) {
      console.warn("[concierge] balance read failed", { userId, err });
    }
  }
  const cap = await maxWordsFor(userId, email);
  return {
    userId,
    email,
    name: user?.name ?? null,
    tier: access.tier,
    lane: unmetered ? "vater" : "jelly",
    unmetered,
    balanceUsd,
    maxWords: Number.isFinite(cap) ? cap : null,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// JSON shapes
// ─────────────────────────────────────────────────────────────────────────────

export interface TicketSummary {
  code: string;
  projectId: string;
  title: string;
  words: number;
  estMinutes: number;
  estimateUsd: number;
  stage: ConciergeTicket["stage"];
  status: string;
  submittedAt: string;
  claimedAt: string | null;
  claimedBy: string | null;
  deliveredAt: string | null;
  jobId: string | null;
  operatorNote: string | null;
  internalNote: string | null;
  customerNote: string | null;
  /** Minutes since submittedAt. */
  ageMin: number;
  errorMessage: string | null;
  /** `stepDetails.phase` as last synced from the DGX, if any. */
  dgxPhase: string | null;
  updatedAt: string;
}

export function projectTitle(p: Pick<YouTubeProject, "sourceTitle" | "topic">): string {
  return (p.sourceTitle || p.topic || "Untitled").replace(/\s*\n+\s*/g, " ").trim();
}

export function dgxPhaseOf(stepDetails: unknown): string | null {
  if (!stepDetails || typeof stepDetails !== "object" || Array.isArray(stepDetails)) return null;
  const phase = (stepDetails as { phase?: unknown }).phase;
  return typeof phase === "string" && phase ? phase : null;
}

export function ticketSummary(
  project: YouTubeProject,
  ticket: ConciergeTicket,
  now: number = Date.now(),
): TicketSummary {
  const submitted = new Date(ticket.submittedAt).getTime();
  return {
    code: ticket.code,
    projectId: project.id,
    title: projectTitle(project),
    words: ticket.words,
    estMinutes: ticket.estMinutes,
    estimateUsd: ticket.estimateUsd,
    stage: ticket.stage,
    status: project.status,
    submittedAt: ticket.submittedAt,
    claimedAt: ticket.claimedAt ?? null,
    claimedBy: ticket.claimedBy ?? null,
    deliveredAt: ticket.deliveredAt ?? null,
    jobId: ticket.jobId ?? project.autopilotJobId ?? null,
    operatorNote: ticket.operatorNote ?? null,
    internalNote: ticket.internalNote ?? null,
    customerNote: ticket.customerNote ?? null,
    ageMin: Number.isFinite(submitted) ? Math.max(0, Math.round((now - submitted) / 60000)) : 0,
    errorMessage: project.errorMessage ?? null,
    dgxPhase: dgxPhaseOf(project.stepDetails),
    updatedAt: project.updatedAt.toISOString(),
  };
}

/** `costJson.totalUsd` (parsed, tolerant) or null. */
export function costTotalUsd(costJson: unknown): number | null {
  const c = parseVideoCost(costJson);
  return c && typeof c.totalUsd === "number" ? Math.round(c.totalUsd * 100) / 100 : null;
}

/** The customer-facing project projection the sync/kickoff routes return. */
export function projectBrief(p: YouTubeProject) {
  return {
    id: p.id,
    status: p.status,
    progress: p.progress,
    autopilotJobId: p.autopilotJobId,
    finalVideoUrl: p.finalVideoUrl,
    errorMessage: p.errorMessage,
    costJson: p.costJson,
    costTotalUsd: costTotalUsd(p.costJson),
    dgxPhase: dgxPhaseOf(p.stepDetails),
    updatedAt: p.updatedAt.toISOString(),
  };
}
