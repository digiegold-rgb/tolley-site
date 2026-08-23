/**
 * POST /api/vater/concierge/[ticket]/kickoff   body {scriptOverride?, force?, by?}
 *
 * Starts the RENDER for a concierge ticket through the site's own
 * `startRunCreation` — so the DGX job carries exactly the same tenant style
 * snapshot, voice, owner lane, word cap and feature bag a Jelly Auto render
 * would. The operator never assembles a job by hand.
 *
 * Order: (optional) script override persisted with a script version →
 * isKickable (style/voice/EL key, 409) → checkBudget('scene', projectId)
 * (402 — same shape as the editor; skipped for unmetered by check-budget
 * itself) → startRunCreation → ticket {stage:'rendering', jobId} +
 * autopilotJobId + stepDetails cleared.
 *
 * Re-kick guard: a ticket that already has a jobId and is rendering|qa is
 * refused (409 already_kicked) unless `force:true` — a second planner run
 * is a second Modal bill.
 *
 * → 200 {jobId, ticket, project}  · 400 ScriptGateError / bad body
 * · 402 {error, budget}  · 409 {code:"terminal"|"not_kickable"|"already_kicked"}
 * · 502 {error, upstream} (AutopilotError)
 */
import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { actorLabel, authorizeConcierge } from "@/lib/vater/concierge-auth";
import { isKickable, wordCount, writeConcierge } from "@/lib/vater/concierge";
import { jsonError, loadTicketProject, projectBrief, readBody } from "@/lib/vater/concierge-operator";
import { checkBudget } from "@/lib/vater/billing/check-budget";
import { appendScriptVersion } from "@/lib/vater/script-versions";
import { startRunCreation, ScriptGateError } from "@/lib/vater/script-gate";
import { AutopilotError } from "@/lib/vater/autopilot-client";
import { queueVaterEvent } from "@/lib/vater/events";
import { quoteMinutes } from "@/lib/vater/billing/estimate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Ctx = { params: Promise<{ ticket: string }> };

interface KickoffBody {
  scriptOverride?: unknown;
  force?: unknown;
  by?: unknown;
}

export async function POST(req: NextRequest, ctx: Ctx) {
  const auth = await authorizeConcierge(req);
  if (!auth.ok) return auth.response;

  const body = await readBody<KickoffBody>(req);
  if (!body) return jsonError(400, "Invalid JSON body");

  const { ticket: param } = await ctx.params;
  const loaded = await loadTicketProject(param);
  if ("response" in loaded) return loaded.response;
  let { project } = loaded;
  const { ticket } = loaded;

  if (ticket.stage === "delivered" || ticket.stage === "cancelled") {
    return jsonError(409, `ticket is ${ticket.stage} — terminal`, { code: "terminal", stage: ticket.stage });
  }
  const force = body.force === true;
  if (!force && ticket.jobId && (ticket.stage === "rendering" || ticket.stage === "qa")) {
    return jsonError(409, `ticket already kicked (job ${ticket.jobId}, stage ${ticket.stage}) — pass force:true to re-kick`, {
      code: "already_kicked",
      jobId: ticket.jobId,
      stage: ticket.stage,
    });
  }

  // ── Optional script override — persisted FIRST so the ticket's script is
  // always what was rendered, and the history keeps the previous text. ──
  const override =
    typeof body.scriptOverride === "string" && body.scriptOverride.trim()
      ? body.scriptOverride.trim()
      : null;
  if (override && override !== (project.script ?? "").trim()) {
    const words = wordCount(override);
    project = await prisma.youTubeProject.update({
      where: { id: project.id },
      data: {
        script: override,
        scriptVersions: appendScriptVersion(project.scriptVersions, "approved", override),
        scriptApprovedAt: new Date(),
        targetWordCount: words,
        targetDuration: quoteMinutes(words),
        scriptMeta: { wordCount: words, targetWordCount: words, source: "fable5-operator" },
      },
    });
  }

  // ── Kickable — style / voice / ElevenLabs key (free, before any spend) ──
  const kick = await isKickable(project);
  if (!kick.ok) {
    return jsonError(409, kick.message, { code: "not_kickable", reason: kick.reason });
  }

  // ── Budget — same gate + 402 shape as submit / approve-script. ──
  if (project.userId) {
    const budget = await checkBudget(project.userId, "scene", null, undefined, { projectId: project.id });
    if (!budget.allow) {
      return NextResponse.json({ error: "Billing check failed", code: "budget", budget }, { status: 402 });
    }
  }

  const by = actorLabel(auth.by, body.by);
  let jobId: string;
  try {
    jobId = await startRunCreation(project, { scriptOverride: project.script ?? undefined });
  } catch (err) {
    if (err instanceof ScriptGateError) {
      return jsonError(400, err.message, { code: "script_gate" });
    }
    if (err instanceof AutopilotError) {
      return NextResponse.json(
        { error: err.message, code: "autopilot", upstream: err.status, body: err.body?.slice(0, 500) },
        { status: 502 },
      );
    }
    throw err;
  }

  const { project: updated, ticket: next } = await writeConcierge(
    project.id,
    { stage: "rendering", jobId },
    {
      status: "concierge_in_progress",
      by,
      historyNote: `kickoff → job ${jobId}${override ? " (script override)" : ""}`,
      extraData: {
        autopilotJobId: jobId,
        stepDetails: Prisma.DbNull,
        errorMessage: null,
        progress: 30,
      },
    },
  );

  console.log(`[concierge/kickoff] ${next.code} project=${project.id} job=${jobId} by=${by}`);
  if (project.userId) {
    queueVaterEvent({
      userId: project.userId,
      kind: "concierge.stage",
      message: `Fable 5 ${next.code}: render kicked (job ${jobId})`,
      projectId: project.id,
      jobId,
      data: { code: next.code, stage: "rendering", by, scriptOverride: !!override },
    });
  }

  return NextResponse.json({ jobId, ticket: next, project: projectBrief(updated) });
}
