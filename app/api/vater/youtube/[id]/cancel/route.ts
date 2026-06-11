/**
 * POST /api/vater/youtube/[id]/cancel
 *
 * Kill-button flow for an in-flight project. Does two things:
 *
 *   1. Tells the DGX worker to stop via `autopilot.cancelJob(autopilotJobId)`.
 *      The worker flips its status to 'cancelled' on the next stage boundary.
 *   2. Rolls the Prisma project status back to 'transcribed' so the editor
 *      re-renders the context form — user can tweak goal/duration/style
 *      and re-kick the pipeline without redoing fetch+transcribe.
 *
 * If the project has no autopilot job (e.g., scripting never actually started),
 * we still flip the local status back so the UI returns to a sensible state.
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
      const r = await autopilot.cancelJob({ jobId: project.autopilotJobId });
      dgxResult = { ok: r.ok, wasRunning: r.wasRunning };
    } catch (err) {
      if (err instanceof AutopilotError) {
        // 404 just means the job registry has no record — that's fine, it
        // may have been cleaned up or crashed. Treat as "already stopped".
        if (err.status === 404) {
          dgxResult = { ok: true, wasRunning: false };
        } else {
          dgxResult = { ok: false, upstream: err.status, error: err.message };
        }
      } else {
        throw err;
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
