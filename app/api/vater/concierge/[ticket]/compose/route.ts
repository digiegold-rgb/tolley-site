/**
 * POST /api/vater/concierge/[ticket]/compose   body {by?}
 *
 * Re-renders final.mp4 from the project row's current VideoSpec (after the
 * operator's /scenes patch) — the concierge twin of
 * `app/api/vater/youtube/[id]/compose`. Same `buildVideoSpec` +
 * `autopilot.composeVideo` with `ownerFieldsForProject` (owner lane /
 * tier / cap), and the new compose job id REPLACES `autopilotJobId` so
 * /sync watches THIS run. Differences from the customer route, on purpose:
 * no checkBudget('render') (repairs are never charged — the debit was
 * taken at the r1 sync and is idempotent) and no per-user rate limit (the
 * operator is the rate limit).
 *
 * Status is set back to `concierge_in_progress` so a prior r1 sync that
 * landed the row on `ready` does not make the next /sync short-circuit as
 * already-terminal.
 *
 * → 200 {jobId, previousJobId}  · 409 {code:"no_job"|"no_spec"|"terminal"}
 * · 502 {error, upstream}
 */
import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";

import { actorLabel, authorizeConcierge } from "@/lib/vater/concierge-auth";
import { writeConcierge } from "@/lib/vater/concierge";
import { jsonError, loadTicketProject, readBody } from "@/lib/vater/concierge-operator";
import { autopilot, AutopilotError } from "@/lib/vater/autopilot-client";
import { buildVideoSpec } from "@/lib/vater/video-spec";
import { ownerFieldsForProject } from "@/lib/vater/owner-tier";
import { queueVaterEvent } from "@/lib/vater/events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Ctx = { params: Promise<{ ticket: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  const auth = await authorizeConcierge(req);
  if (!auth.ok) return auth.response;

  const body = await readBody<{ by?: unknown }>(req);
  if (!body) return jsonError(400, "Invalid JSON body");

  const { ticket: param } = await ctx.params;
  const loaded = await loadTicketProject(param);
  if ("response" in loaded) return loaded.response;
  const { project, ticket } = loaded;

  if (ticket.stage === "delivered" || ticket.stage === "cancelled") {
    return jsonError(409, `ticket is ${ticket.stage} — terminal`, { code: "terminal", stage: ticket.stage });
  }
  if (!project.autopilotJobId) {
    return jsonError(409, "project has no autopilot job id — kick off first", { code: "no_job" });
  }
  const spec = buildVideoSpec(project);
  if (!spec) {
    return jsonError(409, "project missing audio/scenes — sync the render first", { code: "no_spec" });
  }

  const by = actorLabel(auth.by, body.by);
  const previousJobId = project.autopilotJobId;
  let nextJobId: string;
  try {
    const job = await autopilot.composeVideo({
      ...(await ownerFieldsForProject(project.userId)),
      jobId: previousJobId,
      projectId: project.id,
      props: spec,
    });
    nextJobId = job.jobId || previousJobId;
  } catch (err) {
    if (err instanceof AutopilotError) {
      return NextResponse.json(
        { error: err.message, code: "autopilot", upstream: err.status, body: err.body?.slice(0, 500) },
        { status: 502 },
      );
    }
    throw err;
  }

  // composeJobId is what lets /sync re-point autopilotJobId back to the
  // render job (ticket.jobId) once this compose is done — a compose job has
  // no workdir, so leaving autopilotJobId on it 404s every /scene/[idx]
  // (Library card artwork). #50 + #51 both shipped blank cards this way.
  await writeConcierge(
    project.id,
    { composeJobId: nextJobId },
    {
      status: "concierge_in_progress",
      by,
      historyNote: `compose → job ${nextJobId}`,
      extraData: { autopilotJobId: nextJobId, editedAt: new Date(), errorMessage: null },
    },
  );
  // Scene/audio proxies cache autopilotJobId per project (1h) — bust it.
  revalidateTag("vater-youtube-project", "max");

  console.log(`[concierge/compose] ${ticket.code} project=${project.id} job=${nextJobId} (was ${previousJobId}) by=${by}`);
  if (project.userId) {
    queueVaterEvent({
      userId: project.userId,
      kind: "concierge.stage",
      message: `Fable 5 ${ticket.code}: re-compose kicked (job ${nextJobId})`,
      projectId: project.id,
      jobId: nextJobId,
      data: { code: ticket.code, previousJobId, by },
    });
  }

  return NextResponse.json({ jobId: nextJobId, previousJobId });
}
