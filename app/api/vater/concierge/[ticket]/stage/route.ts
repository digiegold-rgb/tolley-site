/**
 * POST /api/vater/concierge/[ticket]/stage   body {stage, note?, internalNote?, by?}
 *
 * Moves the ticket between the operator stages
 *   picked_up | directing | rendering | qa | needs_info
 * and/or updates the notes. `delivered` and `cancelled` are NOT accepted
 * here — they have side effects (email, Telegram, status flip, debit
 * visibility) and live on /deliver and /cancel. A terminal ticket
 * (delivered / cancelled) → 409. `needs_info` requires `note` (it is what
 * the customer reads) and emails it.
 *
 * Same-stage calls are allowed: they just save the notes (history line only
 * when a note is given).
 *
 * → 200 {ticket, status, emailed}  · 400 bad stage / missing note
 * · 409 {code:"terminal"|"not_operator_stage"}
 */
import { NextRequest, NextResponse } from "next/server";

import { actorLabel, authorizeConcierge } from "@/lib/vater/concierge-auth";
import { stageToStatus, writeConcierge, type ConciergeStage, type ConciergeTicket } from "@/lib/vater/concierge";
import { isConciergeStage } from "@/lib/vater/concierge-client";
import {
  editorUrlFor,
  jsonError,
  loadTicketProject,
  projectTitle,
  readBody,
} from "@/lib/vater/concierge-operator";
import { sendConciergeNeedsInfoEmail } from "@/lib/vater/animate-email";
import { queueVaterEvent } from "@/lib/vater/events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

type Ctx = { params: Promise<{ ticket: string }> };

/** Stages the operator may set directly. */
const OPERATOR_STAGES: ReadonlySet<ConciergeStage> = new Set<ConciergeStage>([
  "picked_up",
  "directing",
  "rendering",
  "qa",
  "needs_info",
]);

interface StageBody {
  stage?: unknown;
  note?: unknown;
  internalNote?: unknown;
  by?: unknown;
}

const clip = (v: unknown, n: number): string | undefined =>
  typeof v === "string" && v.trim() ? v.trim().slice(0, n) : undefined;

export async function POST(req: NextRequest, ctx: Ctx) {
  const auth = await authorizeConcierge(req);
  if (!auth.ok) return auth.response;

  const body = await readBody<StageBody>(req);
  if (!body) return jsonError(400, "Invalid JSON body");

  const stage = body.stage;
  if (!isConciergeStage(stage)) {
    return jsonError(400, `stage must be one of ${[...OPERATOR_STAGES].join("|")}`, { code: "bad_stage" });
  }
  if (!OPERATOR_STAGES.has(stage)) {
    return jsonError(409, `stage ${stage} is not set here — use /deliver, /cancel or the customer flow`, {
      code: "not_operator_stage",
    });
  }

  const { ticket: param } = await ctx.params;
  const loaded = await loadTicketProject(param);
  if ("response" in loaded) return loaded.response;
  const { project, ticket } = loaded;

  if (ticket.stage === "delivered" || ticket.stage === "cancelled") {
    return jsonError(409, `ticket is ${ticket.stage} — terminal`, { code: "terminal", stage: ticket.stage });
  }

  const note = clip(body.note, 2000);
  const internalNote = clip(body.internalNote, 4000);
  if (stage === "needs_info" && !note) {
    return jsonError(400, "needs_info requires a customer-visible note", { code: "note_required" });
  }

  const by = actorLabel(auth.by, body.by);
  const patch: Partial<ConciergeTicket> = { stage };
  if (note !== undefined) patch.operatorNote = note;
  if (internalNote !== undefined) patch.internalNote = internalNote;
  // A ticket that was returned to the operator loses its "needs input" note.
  if (ticket.stage === "needs_info" && stage !== "needs_info" && note === undefined) {
    patch.operatorNote = null;
  }

  const { project: updated, ticket: next } = await writeConcierge(project.id, patch, {
    status: stageToStatus(stage),
    by,
    historyNote: note ?? (internalNote ? "(internal note updated)" : null),
    // Clear a stale DGX error when the operator moves the ticket on.
    extraData: stage !== ticket.stage && project.errorMessage ? { errorMessage: null } : undefined,
  });

  let emailed = false;
  if (stage === "needs_info" && note && next.email) {
    try {
      await sendConciergeNeedsInfoEmail(next.email, {
        code: next.code,
        title: projectTitle(project),
        note,
        editorUrl: editorUrlFor(project.id),
      });
      emailed = true;
    } catch (err) {
      console.error("[concierge/stage] needs_info email failed", { code: next.code, err });
    }
  }

  if (project.userId) {
    queueVaterEvent({
      userId: project.userId,
      kind: "concierge.stage",
      level: stage === "needs_info" ? "warn" : "info",
      message: `Fable 5 ${next.code}: ${ticket.stage} → ${stage}${note ? ` — ${note.slice(0, 120)}` : ""}`,
      projectId: project.id,
      jobId: next.jobId ?? null,
      data: { code: next.code, from: ticket.stage, stage, by, emailed },
    });
  }

  return NextResponse.json({ ticket: next, status: updated.status, emailed });
}
