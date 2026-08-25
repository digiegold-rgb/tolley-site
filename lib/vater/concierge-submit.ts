/**
 * lib/vater/concierge-submit.ts — Fable 5 Concierge: the customer submit.
 *
 * One function behind both customer routes:
 *   POST /api/vater/youtube/[id]/concierge   (an existing project)
 *   POST /api/vater/concierge/submit         (batch: N pasted scripts → N rows)
 *
 * Order of gates — every one is FREE (no DGX call, no spend):
 *   1. script length: ≥ CONCIERGE_MIN_WORDS, ≤ maxWordsFor(user) — the same
 *      tier-aware cap /context enforces, same `script_too_long` payload shape
 *   2. status: only draft | scripted | awaiting_script_approval | failed |
 *      concierge_needs_info can become a ticket (409 otherwise — an auto
 *      render that is already spending must not be hijacked)
 *   3. isKickable: style + voice + ElevenLabs key — what startRunCreation
 *      would refuse later, surfaced now so the operator never picks up a
 *      ticket that cannot render
 *   4. checkBudget('scene', {projectId}) — the same 402 shape every editor
 *      step's BillingBlock.assertOk already parses. A pre-check, not a
 *      reservation: the debit happens at delivery, exactly like Auto.
 *
 * Then ONE transaction (writeConcierge) sets the script + approval fields +
 * status `concierge_queued` + the ticket, and the side effects follow
 * best-effort: system-log event, Telegram to Jared, ack email.
 *
 * The caller maps the discriminated result to HTTP. No MustCompleteItem is
 * queued — the /hq "📜 Fable 5" tab IS the queue.
 */
import "server-only";

import type { YouTubeProject } from "@prisma/client";

import { notifyTelegram } from "@/lib/budget/notify";
import { appendScriptVersion } from "@/lib/vater/script-versions";
import { checkBudget, type BudgetCheckResult } from "@/lib/vater/billing/check-budget";
import { maxWordsFor } from "@/lib/vater/billing/script-cap";
import { estimateUsdFor } from "@/lib/vater/billing/ledger";
import { quickEstimateUsd, quoteMinutes } from "@/lib/vater/billing/estimate";
import { isOverLength, lengthMessageFor, runtimeClock } from "@/lib/vater/script-limits";
import { queueVaterEvent } from "@/lib/vater/events";
import { sendConciergeQueuedEmail } from "@/lib/vater/animate-email";
import {
  CONCIERGE_MIN_WORDS,
  isKickable,
  readConcierge,
  ticketCodeFor,
  wordCount,
  writeConcierge,
  type ConciergeTicket,
  type KickableReason,
} from "@/lib/vater/concierge";

export const CONCIERGE_LIBRARY_URL = "https://www.tolley.io/animate#r=library";

/** Statuses a project may be in when it is sent to Fable 5. */
export const CONCIERGE_SUBMIT_FROM_STATUSES: ReadonlySet<string> = new Set([
  "draft",
  "scripted",
  "awaiting_script_approval",
  "failed",
  "concierge_needs_info",
]);

/** Telegram parse_mode is Markdown — unbalanced _ * ` [ ] 400s the send. */
export function tgSafe(v: string): string {
  return v.replace(/[_*`[\]]/g, "");
}

export interface SubmitConciergeInput {
  project: YouTubeProject;
  userId: string;
  email: string | null | undefined;
  /** New script text; omitted/empty → the project's existing script is used. */
  script?: string | null;
  customerNote?: string | null;
  /**
   * Batch callers send ONE Telegram + ONE email for the whole batch, so they
   * pass `quiet: true` and do it themselves. Default: per-ticket notify.
   */
  quiet?: boolean;
}

export type SubmitConciergeResult =
  | {
      ok: true;
      status: 200;
      project: YouTubeProject;
      ticket: ConciergeTicket;
      words: number;
      estMinutes: number;
      estimateUsd: number;
    }
  | {
      ok: false;
      status: 400;
      body: {
        error: "script_too_short" | "script_too_long";
        message: string;
        detail: string;
        wordCount: number;
        maxWords?: number;
        minWords?: number;
      };
    }
  | {
      ok: false;
      status: 409;
      body: { error: string; reason: KickableReason | "bad_status"; currentStatus?: string };
    }
  | {
      ok: false;
      status: 402;
      body: { error: "Billing check failed"; budget: BudgetCheckResult };
    };

export async function submitConcierge(input: SubmitConciergeInput): Promise<SubmitConciergeResult> {
  const { project, userId } = input;
  const email = input.email ?? null;

  // ── 1. Script ────────────────────────────────────────────────────────────
  const script = (typeof input.script === "string" && input.script.trim()
    ? input.script
    : project.script ?? ""
  ).trim();
  const words = wordCount(script);
  if (words < CONCIERGE_MIN_WORDS) {
    return {
      ok: false,
      status: 400,
      body: {
        error: "script_too_short",
        message: `Fable 5 renders a finished script — paste at least ${CONCIERGE_MIN_WORDS} words.`,
        detail: `That script is ${words.toLocaleString()} word${words === 1 ? "" : "s"}; Fable 5 needs at least ${CONCIERGE_MIN_WORDS}.`,
        wordCount: words,
        minWords: CONCIERGE_MIN_WORDS,
      },
    };
  }
  const maxWords = await maxWordsFor(userId, email);
  if (isOverLength(words, maxWords)) {
    const message = lengthMessageFor(maxWords);
    return {
      ok: false,
      status: 400,
      body: {
        error: "script_too_long",
        message,
        detail: `That script is ${words.toLocaleString()} words (≈ ${runtimeClock(words)}). ${message}`,
        wordCount: words,
        maxWords,
      },
    };
  }

  // ── 2. Status ────────────────────────────────────────────────────────────
  if (!CONCIERGE_SUBMIT_FROM_STATUSES.has(project.status)) {
    return {
      ok: false,
      status: 409,
      body: {
        error: `This project is '${project.status}' — Fable 5 takes a project that hasn't started rendering yet.`,
        reason: "bad_status",
        currentStatus: project.status,
      },
    };
  }

  // ── 3. Kickable (style / voice / EL key) ─────────────────────────────────
  const kick = await isKickable({ ...project, script });
  if (!kick.ok) {
    return { ok: false, status: 409, body: { error: kick.message, reason: kick.reason } };
  }

  // ── 4. Credits — same gate, same 402 shape as every editor step ─────────
  const budget = await checkBudget(userId, "scene", null, undefined, { projectId: project.id });
  if (!budget.allow) {
    return { ok: false, status: 402, body: { error: "Billing check failed", budget } };
  }

  // ── Write ────────────────────────────────────────────────────────────────
  const targetDuration = quoteMinutes(words);
  const estMinutes = targetDuration;
  // estimateUsdFor wants the row's planned minutes; quickEstimateUsd is the
  // words-only quote the engine card showed. Prefer the row (it is what the
  // ledger will reserve/debit against), fall back to the quick quote.
  const estimateUsd =
    estimateUsdFor({ targetDuration, audioDuration: project.audioDuration }) ||
    quickEstimateUsd(words);

  const existing = readConcierge(project.settingsJson);
  const nowIso = new Date().toISOString();
  const resubmit = existing?.stage === "needs_info";
  const customerNote =
    typeof input.customerNote === "string" && input.customerNote.trim()
      ? input.customerNote.trim().slice(0, 2000)
      : (existing?.customerNote ?? null);

  const { project: updated, ticket } = await writeConcierge(
    project.id,
    {
      v: 1,
      code: existing?.code ?? ticketCodeFor(project.id),
      userId,
      email: email ?? existing?.email ?? "",
      stage: "queued",
      submittedAt: resubmit ? (existing?.submittedAt ?? nowIso) : nowIso,
      // A fresh submit (or a resubmit) is a clean slate for the operator.
      claimedAt: null,
      claimedBy: null,
      deliveredAt: null,
      cancelledAt: null,
      jobId: null,
      composeJobId: null,
      operatorNote: null,
      customerNote,
      words,
      estMinutes,
      estimateUsd,
      history: existing?.history ?? [],
    },
    {
      status: "concierge_queued",
      by: email ?? userId,
      historyNote: resubmit ? "resubmitted by customer" : "submitted by customer",
      extraData: {
        script,
        scriptVersions: appendScriptVersion(project.scriptVersions, "approved", script),
        scriptApprovedAt: new Date(),
        scriptMeta: { wordCount: words, targetWordCount: words, source: "user-supplied" },
        targetWordCount: words,
        targetDuration,
        progress: 30,
        errorMessage: null,
      },
    },
  );

  // ── Side effects (best-effort, never fail the submit) ───────────────────
  const title = (updated.sourceTitle || updated.topic || "").trim() || null;
  queueVaterEvent({
    userId,
    kind: "concierge.queued",
    projectId: project.id,
    message: `Fable 5 ticket ${ticket.code} queued · ${words} words (~${estMinutes} min) · est $${estimateUsd.toFixed(2)}`,
    data: { code: ticket.code, words, estMinutes, estimateUsd, resubmit },
  });

  if (!input.quiet) {
    void notifyTelegram(conciergeTelegramLine(ticket, email)).catch(() => undefined);
    if (email) {
      sendConciergeQueuedEmail(email, {
        code: ticket.code,
        title,
        words,
        estMinutes,
        libraryUrl: CONCIERGE_LIBRARY_URL,
      }).catch((err) => {
        console.error(`[concierge] ack email failed ticket=${ticket.code}`, err);
      });
    }
  }

  return { ok: true, status: 200, project: updated, ticket, words, estMinutes, estimateUsd };
}

/** "📜 Fable 5 ticket F5-XXXXXX · <email> · N words (~M min) · est $X · /fable5 F5-XXXXXX" */
export function conciergeTelegramLine(
  ticket: Pick<ConciergeTicket, "code" | "words" | "estMinutes" | "estimateUsd">,
  email: string | null | undefined,
): string {
  return (
    `📜 Fable 5 ticket ${tgSafe(ticket.code)} · ${tgSafe(email || "—")} · ` +
    `${ticket.words} words (~${ticket.estMinutes} min) · est $${ticket.estimateUsd.toFixed(2)} · ` +
    `/fable5 ${tgSafe(ticket.code)}`
  );
}
