/**
 * POST /api/vater/concierge/[ticket]/sync   body {jobId?, by?}
 *
 * Pulls the DGX job state onto the project row through the SAME poll core
 * the customer's /poll route uses (`syncProjectFromJob`, policy
 * "concierge"): finalVideoUrl / costJson / scenes / captions / audio, the
 * ledger debit on the transition into `ready` (idempotent on
 * `debit:<projectId>` — repairs never re-debit), usage rows, webhooks,
 * events. Under the concierge policy the customer's `concierge_*` status is
 * only ever replaced by `ready`; a DGX 404 records errorMessage and returns
 * `job_missing` instead of flipping the row to failed.
 *
 * `jobId` re-points `autopilotJobId` first (e.g. after an out-of-band
 * compose); when the row already sits on `ready` from the r1 sync it is set
 * back to `concierge_in_progress` so the new job is actually fetched.
 *
 * Idempotent — call it every tick.
 *
 * → 200 {outcome:"no_job"|"already_terminal"|"job_missing"|"synced", from?, to?,
 *    project:{status,finalVideoUrl,costJson,costTotalUsd,errorMessage,dgxPhase,…},
 *    job?:{status,phase,progress,logs(tail)}, ticket}
 * · 500 AutopilotConfigError · 502 AutopilotError
 */
import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { actorLabel, authorizeConcierge } from "@/lib/vater/concierge-auth";
import { readConcierge, writeConcierge } from "@/lib/vater/concierge";
import { jsonError, loadTicketProject, projectBrief, readBody } from "@/lib/vater/concierge-operator";
import { syncProjectFromJob } from "@/lib/vater/project-sync";
import { AutopilotConfigError, AutopilotError } from "@/lib/vater/autopilot-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Ctx = { params: Promise<{ ticket: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  const auth = await authorizeConcierge(req);
  if (!auth.ok) return auth.response;

  const body = await readBody<{ jobId?: unknown; by?: unknown }>(req);
  if (!body) return jsonError(400, "Invalid JSON body");

  const { ticket: param } = await ctx.params;
  const loaded = await loadTicketProject(param);
  if ("response" in loaded) return loaded.response;
  let { project } = loaded;
  const { ticket } = loaded;

  const jobId = typeof body.jobId === "string" && body.jobId.trim() ? body.jobId.trim() : null;
  if (jobId && jobId !== project.autopilotJobId) {
    const by = actorLabel(auth.by, body.by);
    const res = await writeConcierge(
      project.id,
      {},
      {
        by,
        historyNote: `sync re-pointed job ${project.autopilotJobId ?? "—"} → ${jobId}`,
        extraData: { autopilotJobId: jobId },
        status:
          project.status === "ready" && ticket.stage !== "delivered" ? "concierge_in_progress" : undefined,
      },
    );
    project = res.project;
  }

  try {
    const outcome = await syncProjectFromJob(project, { policy: "concierge" });
    // Re-read so the response carries the post-sync row + ticket (sync writes
    // settingsJson-adjacent columns only, but be exact).
    const fresh = (await prisma.youTubeProject.findUnique({ where: { id: project.id } })) ?? outcome.project;
    const job =
      outcome.kind === "synced"
        ? {
            status: outcome.job.status,
            phase: outcome.job.phase,
            progress: outcome.job.progress,
            logs: Array.isArray(outcome.job.logs) ? outcome.job.logs.slice(-20) : [],
          }
        : undefined;
    return NextResponse.json({
      outcome: outcome.kind,
      ...(outcome.kind === "synced" ? { from: outcome.from, to: outcome.to } : {}),
      project: projectBrief(fresh),
      job,
      ticket: readConcierge(fresh.settingsJson),
    });
  } catch (err) {
    if (err instanceof AutopilotConfigError) {
      return NextResponse.json({ error: err.message, code: "autopilot_config" }, { status: 500 });
    }
    if (err instanceof AutopilotError) {
      return NextResponse.json(
        { error: err.message, code: "autopilot", upstream: err.status },
        { status: 502 },
      );
    }
    throw err;
  }
}
