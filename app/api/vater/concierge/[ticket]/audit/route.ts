/**
 * POST /api/vater/concierge/[ticket]/audit   body = the audit-r{N}.json dict
 *
 * The site-side copy of the DGX delivery audit (fable5-audit.py). 2026-08-28
 * incident: F5-B0A50J was delivered 24 s BEFORE its audit ran — the audit
 * only lived in tickets/<t>/audit-rN.json on the DGX, the deliver route gated
 * on finalVideoUrl alone and the /hq board had no audit state. Now the
 * script POSTs every audit here, `/deliver` refuses without a PASSING audit
 * that matches the current final, and the board shows the chip.
 *
 * Body keys read (everything else ignored): round, source, at, finalV,
 * finalVideoUrl, jobId, hardFails, sceneCount, judged, byCheck (≤40 keys),
 * hardScenes (≤500), costUsd, rulesVersion (string or {version}), reportUrl
 * (http(s), ≤500 chars). `passed` is COMPUTED: hardFails === 0 && judged >=
 * sceneCount — never trusted from the body.
 *
 * Never changes the stage. A delivered/cancelled ticket still records the
 * audit (a post-delivery audit is worth having on the record).
 *
 * → 200 {ticket} · 400 {code:"bad_audit"} · 404 · 401
 */
import { NextRequest, NextResponse } from "next/server";

import { actorLabel, authorizeConcierge } from "@/lib/vater/concierge-auth";
import { writeConcierge } from "@/lib/vater/concierge";
import { parseConciergeAudit } from "@/lib/vater/concierge-client";
import { jsonError, loadTicketProject, readBody } from "@/lib/vater/concierge-operator";
import { queueVaterEvent } from "@/lib/vater/events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

type Ctx = { params: Promise<{ ticket: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  const auth = await authorizeConcierge(req);
  if (!auth.ok) return auth.response;

  const body = await readBody<Record<string, unknown>>(req);
  if (!body) return jsonError(400, "Invalid JSON body");

  const audit = parseConciergeAudit(body);
  if (!audit) {
    return jsonError(400, "audit body needs a numeric round ≥ 1 (send the audit-rN.json dict)", {
      code: "bad_audit",
    });
  }

  const { ticket: param } = await ctx.params;
  const loaded = await loadTicketProject(param);
  if ("response" in loaded) return loaded.response;
  const { project, ticket } = loaded;

  const by = actorLabel(auth.by, body.by);
  const verdict = audit.passed ? "PASS" : "FAIL";
  const note =
    `audit r${audit.round} (${audit.source}): ${verdict} ${audit.hardFails}/${audit.sceneCount} hard` +
    ` · $${audit.costUsd.toFixed(2)}` +
    (audit.judged < audit.sceneCount ? ` · ${audit.sceneCount - audit.judged} unjudged` : "") +
    (audit.reportUrl ? ` · ${audit.reportUrl}` : "");

  const { ticket: next } = await writeConcierge(project.id, { audit }, { by, historyNote: note });

  if (project.userId) {
    queueVaterEvent({
      userId: project.userId,
      kind: "concierge.audit",
      level: audit.passed ? "info" : "warn",
      message: `Fable 5 ${next.code}: ${note}`,
      projectId: project.id,
      jobId: audit.jobId ?? next.jobId ?? null,
      data: {
        code: next.code,
        by,
        round: audit.round,
        source: audit.source,
        passed: audit.passed,
        hardFails: audit.hardFails,
        sceneCount: audit.sceneCount,
        stage: ticket.stage,
      },
    });
  }

  return NextResponse.json({ ticket: next });
}
