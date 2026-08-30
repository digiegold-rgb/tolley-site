/**
 * POST /api/vater/youtube/[id]/cancel
 *
 * Stop the DGX worker for an in-flight project. Does two things:
 *
 *   1. Tells the DGX worker to stop via `autopilot.cancelJob(autopilotJobId)`.
 *      The worker flips its status to 'cancelled' on the next stage boundary.
 *      A leftover `scripting`/`queued` row with no live job (DGX 404, no
 *      `autopilotJobId`, unreachable worker) is treated as already stopped
 *      so Force Kill can still DELETE the row.
 *   2. Rolls the Prisma project status back to 'transcribed' (or `failed`
 *      with no transcript). That is NOT the customer-facing Force Kill
 *      outcome — Create then DELETE `/api/vater/youtube/[id]` and lands
 *      on a fresh step 1. Soft-reset to transcribed is the old cancel.
 *
 * If the project has no autopilot job (e.g., scripting never actually started),
 * we still flip the local status so older kill buttons keep a sensible state.
 */
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { autopilot, AutopilotError } from "@/lib/vater/autopilot-client";
import { canAccessProject } from "@/lib/vater/project-access";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: Request, ctx: Ctx) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;

  const project = await prisma.youTubeProject.findUnique({
    where: { id },
    select: {
      id: true,
      userId: true,
      status: true,
      autopilotJobId: true,
      transcript: true,
    },
  });
  if (
    !project ||
    !canAccessProject(project.userId, session.user.id, session.user.email)
  ) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  let dgxResult: {
    ok: boolean;
    wasRunning?: boolean;
    upstream?: number;
    error?: string;
  } = { ok: false };

  if (project.autopilotJobId) {
    try {
      // canAccessProject() above already established that this session may
      // act on this project, so ownerId IS the proof the DGX asks for. An
      // admin cancelling someone else's project falls back to an explicit,
      // logged override rather than silently borrowing the owner's identity.
      const actingAsOwner =
        !project.userId || project.userId === session.user.id;
      const r = await autopilot.cancelJob({
        jobId: project.autopilotJobId,
        ...(actingAsOwner
          ? { ownerId: project.userId ?? session.user.id }
          : {
              override: true,
              reason: `admin ${session.user.email ?? session.user.id} cancelled project ${project.id}`,
            }),
      });
      dgxResult = { ok: r.ok, wasRunning: r.wasRunning };
    } catch (err) {
      if (err instanceof AutopilotError && err.status === 404) {
        // Job registry has no record — cleaned up or crashed. Already stopped.
        dgxResult = { ok: true, wasRunning: false };
      } else {
        // Leftover scripting/queued with a dead or unreachable worker must
        // still reset so Force Kill can DELETE. Do not 500 the request.
        dgxResult = {
          ok: true,
          wasRunning: false,
          ...(err instanceof AutopilotError ? { upstream: err.status } : {}),
          error: err instanceof Error ? err.message : "dgx unreachable",
        };
      }
    }
  } else {
    dgxResult = { ok: true, wasRunning: false };
  }

  // Flip local project status back to `transcribed` (if we have a transcript)
  // so the editor re-renders the YouTubeContextForm + the user can restart
  // the pipeline from principles without redoing the fetch/whisper step.
  // Falls back to `failed` if there's no transcript to return to.
  const targetStatus = project.transcript ? "transcribed" : "failed";
  const updated = await prisma.youTubeProject.update({
    where: { id },
    data: {
      status: targetStatus,
      progress: 0,
      errorMessage: dgxResult.ok
        ? null
        : `cancel partially failed: ${dgxResult.error ?? "unknown"}`,
      editedAt: new Date(),
    },
    select: { id: true, status: true, progress: true, errorMessage: true },
  });

  return NextResponse.json({
    ok: true,
    dgx: dgxResult,
    project: updated,
    note: dgxResult.wasRunning
      ? "DGX worker will stop at the next stage boundary. Project is ready to restart from principles."
      : "No active DGX job — project reset to ready-to-restart state.",
  });
}
