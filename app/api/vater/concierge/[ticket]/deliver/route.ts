/**
 * POST /api/vater/concierge/[ticket]/deliver   body {note?, by?}
 *
 * The hand-back. Syncs first when the row has no finalVideoUrl yet (so an
 * operator who forgot /sync still gets the debit + cost merge through the
 * one path that writes them), refuses with 409 `not_rendered` when there is
 * still no final, then flips the ticket to `delivered` (status `ready` —
 * it IS a finished render), stores the customer-visible note, emails the
 * customer a Library link, Telegrams Jared the charge line, and logs the
 * event.
 *
 * Double-send guard: a ticket with `deliveredAt` already set returns
 * 200 {already:true} and sends NOTHING.
 *
 * → 200 {ticket, status, emailed, chargeLine, finalVideoUrl, already?}
 * · 409 {code:"not_rendered", outcome} | {code:"terminal"}
 */
import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { actorLabel, authorizeConcierge } from "@/lib/vater/concierge-auth";
import { writeConcierge } from "@/lib/vater/concierge";
import {
  CONCIERGE_LIBRARY_URL,
  conciergeTelegram,
  costTotalUsd,
  jsonError,
  loadTicketProject,
  projectTitle,
  readBody,
  resolveOwner,
  tgSafe,
} from "@/lib/vater/concierge-operator";
import { syncProjectFromJob } from "@/lib/vater/project-sync";
import { getProjectDebit } from "@/lib/vater/billing/ledger";
import { sendConciergeDeliveredEmail } from "@/lib/vater/animate-email";
import { queueVaterEvent } from "@/lib/vater/events";
import { notifyFlowTransition } from "@/lib/vater/flow-notify";
import { AutopilotConfigError, AutopilotError } from "@/lib/vater/autopilot-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Ctx = { params: Promise<{ ticket: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  const auth = await authorizeConcierge(req);
  if (!auth.ok) return auth.response;

  const body = await readBody<{ note?: unknown; by?: unknown }>(req);
  if (!body) return jsonError(400, "Invalid JSON body");

  const { ticket: param } = await ctx.params;
  const loaded = await loadTicketProject(param);
  if ("response" in loaded) return loaded.response;
  let { project } = loaded;
  const { ticket } = loaded;

  if (ticket.deliveredAt || ticket.stage === "delivered") {
    return NextResponse.json({
      already: true,
      ticket,
      status: project.status,
      emailed: false,
      chargeLine: null,
      finalVideoUrl: project.finalVideoUrl,
    });
  }
  if (ticket.stage === "cancelled") {
    return jsonError(409, "ticket is cancelled — terminal", { code: "terminal", stage: ticket.stage });
  }

  // ── Sync first if the row has no final yet ──────────────────────────────
  let syncOutcome: string | null = null;
  if (!project.finalVideoUrl && project.autopilotJobId) {
    try {
      const outcome = await syncProjectFromJob(project, { policy: "concierge" });
      syncOutcome = outcome.kind;
      project = (await prisma.youTubeProject.findUnique({ where: { id: project.id } })) ?? outcome.project;
    } catch (err) {
      if (err instanceof AutopilotConfigError) {
        return NextResponse.json({ error: err.message, code: "autopilot_config" }, { status: 500 });
      }
      if (err instanceof AutopilotError) {
        return NextResponse.json({ error: err.message, code: "autopilot", upstream: err.status }, { status: 502 });
      }
      throw err;
    }
  }
  if (!project.finalVideoUrl) {
    return jsonError(409, "no finished video on the project yet — render and sync first", {
      code: "not_rendered",
      outcome: syncOutcome,
      status: project.status,
      errorMessage: project.errorMessage,
    });
  }

  // ── Charge line (best-effort; never blocks delivery) ────────────────────
  const owner = await resolveOwner(project.userId);
  let chargeLine = "unmetered";
  let chargedUsd: number | null = null;
  if (!owner.unmetered) {
    try {
      const debit = await getProjectDebit(project.id);
      if (debit) {
        chargedUsd = Math.abs(debit.deltaCents) / 100;
        chargeLine = `$${chargedUsd.toFixed(2)} debited`;
      } else {
        const cost = costTotalUsd(project.costJson);
        chargeLine = cost != null ? `$${cost.toFixed(2)} cost — ledger debit pending` : "debit pending";
      }
    } catch (err) {
      console.warn("[concierge/deliver] debit lookup failed", { projectId: project.id, err });
      chargeLine = "debit unknown";
    }
  }

  const note = typeof body.note === "string" && body.note.trim() ? body.note.trim().slice(0, 2000) : null;
  const by = actorLabel(auth.by, body.by);
  const nowIso = new Date().toISOString();
  const { project: updated, ticket: next } = await writeConcierge(
    project.id,
    { stage: "delivered", deliveredAt: nowIso, operatorNote: note },
    {
      status: "ready",
      by,
      historyNote: note ?? `delivered (${chargeLine})`,
      // Stepped flow (2026-08-28): Done.
      extraData: { flowStep: 8, flowStepAt: new Date(), approvalExpiresAt: null },
    },
  );

  // Push only — the delivered email below is the customer's email for this step.
  try {
    await notifyFlowTransition(project.id, "ready", { email: false });
  } catch (err) {
    console.error("[concierge/deliver] ready push failed", { code: next.code, err });
  }

  // ── Customer email ──────────────────────────────────────────────────────
  let emailed = false;
  if (next.email) {
    try {
      await sendConciergeDeliveredEmail(next.email, {
        code: next.code,
        title: projectTitle(project),
        libraryUrl: CONCIERGE_LIBRARY_URL,
        chargeLine:
          chargedUsd != null
            ? `Billed: $${chargedUsd.toFixed(2)} from your credits — the same price an Auto render would have been.`
            : null,
        note,
      });
      emailed = true;
    } catch (err) {
      console.error("[concierge/deliver] email failed", { code: next.code, err });
    }
  }

  // ── Telegram + event ────────────────────────────────────────────────────
  await conciergeTelegram(
    `✅ delivered ${next.code} · ${tgSafe(next.email || owner.email || "—")} · ${tgSafe(chargeLine)}` +
      `${emailed ? "" : " · ⚠️ email NOT sent"}`,
  );
  if (project.userId) {
    queueVaterEvent({
      userId: project.userId,
      kind: "concierge.delivered",
      message: `Fable 5 ${next.code}: delivered (${chargeLine})`,
      projectId: project.id,
      jobId: project.autopilotJobId,
      data: { code: next.code, by, chargeLine, chargedUsd, emailed, finalVideoUrl: project.finalVideoUrl },
    });
  }

  return NextResponse.json({
    ticket: next,
    status: updated.status,
    emailed,
    chargeLine,
    finalVideoUrl: project.finalVideoUrl,
  });
}
