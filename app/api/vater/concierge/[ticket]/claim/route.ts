/**
 * POST /api/vater/concierge/[ticket]/claim   body {by?}
 *
 * Operator picks the ticket up: stage queued|needs_info → picked_up, status
 * concierge_in_progress, claimedAt/claimedBy stamped. 409 from any other
 * stage (already claimed / rendering / delivered / cancelled) — the CLI
 * treats that as "someone else has it", never as a retry.
 *
 * → 200 {ticket, status}  · 409 {error, code:"not_claimable", stage}
 */
import { NextRequest, NextResponse } from "next/server";

import { actorLabel, authorizeConcierge } from "@/lib/vater/concierge-auth";
import { writeConcierge } from "@/lib/vater/concierge";
import { jsonError, loadTicketProject, readBody } from "@/lib/vater/concierge-operator";
import { queueVaterEvent } from "@/lib/vater/events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

type Ctx = { params: Promise<{ ticket: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  const auth = await authorizeConcierge(req);
  if (!auth.ok) return auth.response;

  const body = await readBody<{ by?: string }>(req);
  if (!body) return jsonError(400, "Invalid JSON body");

  const { ticket: param } = await ctx.params;
  const loaded = await loadTicketProject(param);
  if ("response" in loaded) return loaded.response;
  const { project, ticket } = loaded;

  if (ticket.stage !== "queued" && ticket.stage !== "needs_info") {
    return jsonError(409, `ticket is ${ticket.stage} — only queued or needs_info tickets can be claimed`, {
      code: "not_claimable",
      stage: ticket.stage,
    });
  }

  const by = actorLabel(auth.by, body.by);
  const nowIso = new Date().toISOString();
  const { project: updated, ticket: next } = await writeConcierge(
    project.id,
    { stage: "picked_up", claimedAt: nowIso, claimedBy: by },
    { status: "concierge_in_progress", by, historyNote: `claimed by ${by}` },
  );

  if (project.userId) {
    queueVaterEvent({
      userId: project.userId,
      kind: "concierge.stage",
      message: `Fable 5 ${next.code}: picked up by ${by}`,
      projectId: project.id,
      data: { code: next.code, stage: "picked_up", by },
    });
  }

  return NextResponse.json({ ticket: next, status: updated.status });
}
