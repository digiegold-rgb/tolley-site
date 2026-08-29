/**
 * POST /api/vater/concierge/[ticket]/deliver   body {note?, by?, waive?, waiveReason?}
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
 * AUDIT GATE (2026-08-28, after F5-B0A50J shipped 24 s before its audit ran
 * and then failed 29/34): the ticket must carry a PASSING audit that speaks
 * for the CURRENT final (`auditMatchesFinal` — same `?v=` / same URL, or an
 * r1 audit of the same render job with no repair compose since). Otherwise
 * 409 `audit_missing` / `audit_failed`. Override: body
 * `{waive:true, waiveReason:"≥8 chars"}` delivers anyway and stamps the
 * waiver on history + internalNote + Telegram. The CLI's local pre-check
 * stays; this is the server truth.
 *
 * → 200 {ticket, status, emailed, chargeLine, finalVideoUrl, already?, waived?}
 * · 409 {code:"not_rendered", outcome} | {code:"terminal"}
 * · 409 {code:"audit_missing", message} | {code:"audit_failed", hardFails, sceneCount, round, reportUrl}
 * · 400 {code:"waive_reason_required"}
 */
import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { actorLabel, authorizeConcierge } from "@/lib/vater/concierge-auth";
import { readConcierge, writeConcierge } from "@/lib/vater/concierge";
import { auditMatchesFinal } from "@/lib/vater/concierge-client";
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

  const body = await readBody<{ note?: unknown; by?: unknown; waive?: unknown; waiveReason?: unknown }>(req);
  if (!body) return jsonError(400, "Invalid JSON body");

  const waive = body.waive === true;
  const waiveReason =
    typeof body.waiveReason === "string" && body.waiveReason.trim().length >= 8
      ? body.waiveReason.trim().slice(0, 500)
      : null;
  if (waive && !waiveReason) {
    return jsonError(400, "waive:true needs waiveReason (≥ 8 chars) — say why this ships without a passing audit", {
      code: "waive_reason_required",
    });
  }

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

  // ── Delivery audit gate ─────────────────────────────────────────────────
  // Re-read the ticket: the sync above may have re-pointed jobs.
  const fresh = readConcierge(project.settingsJson) ?? ticket;
  const audit = fresh.audit ?? null;
  const auditMatches = auditMatchesFinal(audit, {
    finalVideoUrl: project.finalVideoUrl,
    jobId: fresh.jobId ?? null,
    composeJobId: fresh.composeJobId ?? null,
  });
  if (!waive) {
    if (!auditMatches) {
      return jsonError(409, "no delivery audit for this final yet", {
        code: "audit_missing",
        message:
          "no delivery audit for this final yet — the runner audits after sync; wait for it (or deliver anyway with a reason)",
        finalVideoUrl: project.finalVideoUrl,
        lastAudit: audit
          ? { round: audit.round, source: audit.source, at: audit.at, finalV: audit.finalV, passed: audit.passed }
          : null,
      });
    }
    if (!audit!.passed) {
      return jsonError(
        409,
        `delivery audit r${audit!.round} FAILED — ${audit!.hardFails}/${audit!.sceneCount} scenes with hard failures`,
        {
          code: "audit_failed",
          hardFails: audit!.hardFails,
          sceneCount: audit!.sceneCount,
          round: audit!.round,
          reportUrl: audit!.reportUrl,
        },
      );
    }
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
  // Waiver stamp — only when the gate would have refused (a waive:true on a
  // ticket whose audit already passes is a no-op, not a waiver).
  const waived = waive && !(auditMatches && audit?.passed);
  const waiverLine = waived
    ? `DELIVERED WITH AUDIT WAIVER by ${by}: ${waiveReason}` +
      (audit
        ? ` (last audit r${audit.round} ${audit.passed ? "PASS" : `FAIL ${audit.hardFails}/${audit.sceneCount}`}${auditMatches ? "" : ", not for this final"})`
        : " (no audit on file)")
    : null;
  const internalNote = waiverLine
    ? `${waiverLine}${fresh.internalNote ? `\n${fresh.internalNote}` : ""}`.slice(0, 4000)
    : undefined;
  const { project: updated, ticket: next } = await writeConcierge(
    project.id,
    {
      stage: "delivered",
      deliveredAt: nowIso,
      operatorNote: note,
      ...(internalNote !== undefined ? { internalNote } : {}),
    },
    {
      status: "ready",
      by,
      historyNote: waiverLine
        ? `${waiverLine} · ${note ?? `delivered (${chargeLine})`}`
        : (note ?? `delivered (${chargeLine})`),
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
    `${waived ? "⚠️ delivered WITH AUDIT WAIVER" : "✅ delivered"} ${next.code} · ${tgSafe(next.email || owner.email || "—")} · ${tgSafe(chargeLine)}` +
      `${emailed ? "" : " · ⚠️ email NOT sent"}` +
      `${waived ? `\nwaiver by ${tgSafe(by)}: ${tgSafe(waiveReason)}` : ""}`,
  );
  if (project.userId) {
    queueVaterEvent({
      userId: project.userId,
      kind: "concierge.delivered",
      message: `Fable 5 ${next.code}: delivered (${chargeLine})`,
      projectId: project.id,
      jobId: project.autopilotJobId,
      data: {
        code: next.code,
        by,
        chargeLine,
        chargedUsd,
        emailed,
        finalVideoUrl: project.finalVideoUrl,
        waived,
        waiveReason: waived ? waiveReason : null,
        auditRound: audit?.round ?? null,
      },
    });
  }

  return NextResponse.json({
    ticket: next,
    status: updated.status,
    emailed,
    chargeLine,
    finalVideoUrl: project.finalVideoUrl,
    waived,
  });
}
