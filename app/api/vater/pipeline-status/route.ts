/**
 * GET /api/vater/pipeline-status
 *
 * Thin proxy to the autopilot `/vater/pipeline-status` endpoint. Returns a
 * live snapshot of both ComfyUI instances (interactive :8188 and Vater
 * :8189) plus any currently-running Vater jobs. Polled by the /vater/youtube
 * page every ~3s so the user sees GPU + queue progress without SSH.
 *
 * Tenant isolation (Phase 1 beta lockdown, 2026-08-15): `activeJobs` used to
 * be handed to ANY signed-in user, leaking every other customer's jobId,
 * projectId, phase and lastLog (which contains scene/prompt text). Now:
 *   - owner (isVaterAdminEmail)  → unfiltered
 *   - x-sync-secret (DGX/agent)  → unfiltered (server-to-server)
 *   - everyone else, studio tier INCLUDED → only jobs attributable to one of
 *     their own YouTubeProject rows, and `lastLog` only when the job carried
 *     an explicit projectId we matched (never on a jobId-only match).
 * Instance health (VRAM/queue depth) stays visible to all — it's infra
 * status the UI renders, not customer data.
 */
import { NextResponse } from "next/server";
import {
  autopilot,
  AutopilotError,
  type PipelineActiveJob,
} from "@/lib/vater/autopilot-client";
import { requireVaterProxyRead } from "@/lib/vater/proxy-auth";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isVaterAdminEmail } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Reduce the DGX's global activeJobs list to what this user owns.
 * Matches on project id, autopilotJobId, animateAllJobId, and any jobId key
 * recorded in costJson.byJob (batch/animate jobs land there).
 */
async function scopeActiveJobs(
  jobs: PipelineActiveJob[],
  userId: string,
): Promise<PipelineActiveJob[]> {
  if (!jobs.length) return [];

  const projects = await prisma.youTubeProject.findMany({
    where: { userId },
    select: {
      id: true,
      autopilotJobId: true,
      animateAllJobId: true,
      costJson: true,
    },
  });

  const projectIds = new Set(projects.map((p) => p.id));
  const jobIds = new Set<string>();
  for (const p of projects) {
    if (p.autopilotJobId) jobIds.add(p.autopilotJobId);
    if (p.animateAllJobId) jobIds.add(p.animateAllJobId);
    const byJob = (p.costJson as { byJob?: Record<string, unknown> } | null)
      ?.byJob;
    if (byJob && typeof byJob === "object") {
      for (const key of Object.keys(byJob)) jobIds.add(key);
    }
  }

  const out: PipelineActiveJob[] = [];
  for (const job of jobs) {
    const byProject = !!job.projectId && projectIds.has(job.projectId);
    const byJobId = !!job.jobId && jobIds.has(job.jobId);
    if (!byProject && !byJobId) continue;
    // lastLog can carry scene text / prompts. Only expose it when the job
    // named a project we positively own.
    out.push(byProject ? job : { ...job, lastLog: null });
  }
  return out;
}

export async function GET(req: Request) {
  const gate = await requireVaterProxyRead(req);
  if (!gate.ok) return gate.response;

  // requireVaterProxyRead also passes x-sync-secret callers, which have no
  // session. Those are trusted server-to-server (DGX, crons) → unfiltered.
  const session = await auth();
  const userId = session?.user?.id ?? null;
  const isOwner = isVaterAdminEmail(session?.user?.email);

  try {
    const status = await autopilot.getPipelineStatus();
    const activeJobs =
      !userId || isOwner
        ? (status.activeJobs ?? [])
        : await scopeActiveJobs(status.activeJobs ?? [], userId);

    return NextResponse.json(
      { ...status, activeJobs },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    if (err instanceof AutopilotError) {
      return NextResponse.json(
        {
          error: "Failed to fetch pipeline status",
          status: err.status,
          detail: err.body || err.message,
        },
        { status: 502 },
      );
    }
    return NextResponse.json(
      {
        error: "Failed to fetch pipeline status",
        detail: err instanceof Error ? err.message : "unknown",
      },
      { status: 502 },
    );
  }
}
