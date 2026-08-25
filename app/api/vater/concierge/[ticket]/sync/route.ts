/**
 * POST /api/vater/concierge/[ticket]/sync   body {jobId?, by?, repointOnly?}
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
import { revalidateTag } from "next/cache";

import { syncProjectFromJob } from "@/lib/vater/project-sync";
import { AutopilotConfigError, AutopilotError } from "@/lib/vater/autopilot-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Ctx = { params: Promise<{ ticket: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  const auth = await authorizeConcierge(req);
  if (!auth.ok) return auth.response;

  const body = await readBody<{ jobId?: unknown; by?: unknown; repointOnly?: unknown }>(req);
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
    // The scene/audio/video proxies resolve autopilotJobId through a 1h
    // unstable_cache (project-jobid-cache) that persists across deploys —
    // built when the id was immutable. It isn't any more: without this, a
    // repoint leaves every /scene/[idx] hit (Library artwork) resolving the
    // OLD job for up to an hour.
    revalidateTag("vater-youtube-project", "max");
  }

  /* repointOnly (2026-08-23): move autopilotJobId WITHOUT re-running the sync.
   * Scene assets live in the RENDER job's workdir (`vater_work/<job>/scenes/`);
   * a compose job has no workdir at all. Syncing the compose job picks up the
   * fresh finalVideoUrl `?v=` but leaves autopilotJobId on a job the
   * /scene/[idx] proxy can't serve — every scene image (and the Library card
   * artwork) 404s. The CLI now syncs the compose job, then repoints back to
   * the render job with this flag so BOTH survive. Re-syncing the render job
   * instead would regress finalVideoUrl to the r1 cache-buster. */
  if (body.repointOnly === true) {
    if (!jobId) return jsonError(400, "repointOnly requires jobId");
    // Unconditional on this branch: re-running a repoint to the SAME id is
    // the operator's way to flush a stale jobid cache entry.
    revalidateTag("vater-youtube-project", "max");
    const fresh = (await prisma.youTubeProject.findUnique({ where: { id: project.id } })) ?? project;
    return NextResponse.json({
      outcome: "repointed",
      project: projectBrief(fresh),
      ticket: readConcierge(fresh.settingsJson),
    });
  }

  try {
    const outcome = await syncProjectFromJob(project, { policy: "concierge" });
    // Re-read so the response carries the post-sync row + ticket (sync writes
    // settingsJson-adjacent columns only, but be exact).
    let fresh = (await prisma.youTubeProject.findUnique({ where: { id: project.id } })) ?? outcome.project;

    /* Auto-repoint (2026-08-25). When the job just synced is the ticket's
     * COMPOSE job and it is done, the fresh finalVideoUrl is on the row but
     * autopilotJobId now names a job with no workdir — every /scene/[idx]
     * hit (Library artwork) 404s. The CLI only repointed when the operator
     * passed `--job`, which the headless runner never does (#51). Do it here
     * so no caller has to remember. */
    let repointedTo: string | null = null;
    if (outcome.kind === "synced" && outcome.job.status === "done") {
      const t = readConcierge(fresh.settingsJson);
      if (
        t?.composeJobId &&
        t.jobId &&
        t.jobId !== t.composeJobId &&
        fresh.autopilotJobId === t.composeJobId
      ) {
        const res = await writeConcierge(
          project.id,
          {},
          {
            by: actorLabel(auth.by, body.by),
            historyNote: `compose ${t.composeJobId} done — re-pointed back to render job ${t.jobId} (scene assets)`,
            extraData: { autopilotJobId: t.jobId },
          },
        );
        fresh = res.project;
        repointedTo = t.jobId;
        revalidateTag("vater-youtube-project", "max");
      }
    }
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
      ...(repointedTo ? { repointedTo } : {}),
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
