/**
 * POST /api/vater/concierge/[ticket]/cancel   body {note?, by?}
 *
 * OPERATOR cancel (the customer's own cancel is DELETE
 * /api/vater/youtube/[id]/concierge and only works while queued). Any live
 * stage → `cancelled`; status `scripted` so the approved script stays and
 * the customer can re-submit or render on Auto. Emails the customer the
 * note when one is given, Telegrams Jared, logs the event. Does NOT touch
 * the DGX job — the CLI cancels that itself (`/vater/cancel-job`) before
 * calling here, since it knows whether the job is still running.
 *
 * Idempotent: an already-cancelled ticket → 200 {already:true}.
 *
 * → 200 {ticket, status, emailed, already?}  · 409 {code:"terminal"} (delivered)
 */
import { NextRequest, NextResponse } from "next/server";

import { actorLabel, authorizeConcierge } from "@/lib/vater/concierge-auth";
import { writeConcierge } from "@/lib/vater/concierge";
import {
  conciergeTelegram,
  editorUrlFor,
  jsonError,
  loadTicketProject,
  projectTitle,
  readBody,
  tgSafe,
} from "@/lib/vater/concierge-operator";
import { sendConciergeNeedsInfoEmail } from "@/lib/vater/animate-email";
import { queueVaterEvent } from "@/lib/vater/events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

type Ctx = { params: Promise<{ ticket: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  const auth = await authorizeConcierge(req);
  if (!auth.ok) return auth.response;

  const body = await readBody<{ note?: unknown; by?: unknown }>(req);
  if (!body) return jsonError(400, "Invalid JSON body");

  const { ticket: param } = await ctx.params;
  const loaded = await loadTicketProject(param);
  if ("response" in loaded) return loaded.response;
  const { project, ticket } = loaded;

  if (ticket.stage === "cancelled") {
    return NextResponse.json({ already: true, ticket, status: project.status, emailed: false });
  }
  if (ticket.stage === "delivered") {
    return jsonError(409, "ticket is delivered — terminal", { code: "terminal", stage: ticket.stage });
  }

  const note = typeof body.note === "string" && body.note.trim() ? body.note.trim().slice(0, 2000) : null;
  const by = actorLabel(auth.by, body.by);
  const { project: updated, ticket: next } = await writeConcierge(
    project.id,
    { stage: "cancelled", cancelledAt: new Date().toISOString(), operatorNote: note },
    { status: "scripted", by, historyNote: note ?? `cancelled by ${by}` },
  );

  let emailed = false;
  if (note && next.email) {
    try {
      // Reuses the needs-info template: "Fable 5 paused <title> and needs one
      // thing from you: <note> … nothing has been charged". That IS the
      // customer-facing truth of an operator cancel.
      await sendConciergeNeedsInfoEmail(next.email, {
        code: next.code,
        title: projectTitle(project),
        note,
        editorUrl: editorUrlFor(project.id),
      });
      emailed = true;
    } catch (err) {
      console.error("[concierge/cancel] email failed", { code: next.code, err });
    }
  }

  await conciergeTelegram(
    `🛑 cancelled ${next.code} · ${tgSafe(next.email || "—")} · by ${tgSafe(by)}${note ? ` · ${tgSafe(note.slice(0, 140))}` : ""}`,
  );
  if (project.userId) {
    queueVaterEvent({
      userId: project.userId,
      kind: "concierge.cancelled",
      level: "warn",
      message: `Fable 5 ${next.code}: cancelled by ${by}${note ? ` — ${note.slice(0, 120)}` : ""}`,
      projectId: project.id,
      jobId: next.jobId ?? null,
      data: { code: next.code, by, from: ticket.stage, emailed },
    });
  }

  return NextResponse.json({ ticket: next, status: updated.status, emailed });
}
