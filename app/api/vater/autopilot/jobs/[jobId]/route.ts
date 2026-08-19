/**
 * GET /api/vater/autopilot/jobs/[jobId]
 *
 * Thin proxy to the DGX autopilot's /vater/jobs/{id} endpoint. Used by
 * Style editor inline jobs (reference transcribe, character gen, custom
 * art style describer) and by the batch-animate poller.
 *
 * Auth (Phase 1 beta lockdown, 2026-08-15): a session alone is no longer
 * enough — the DGX job payload carries scripts, prompts and log tails.
 *   - owner (isVaterAdminEmail) → unrestricted
 *   - ?projectId=<id>           → caller must pass canAccessProject AND the
 *                                 job must actually be recorded on that
 *                                 project (no borrowing your own project id
 *                                 to read someone else's job)
 *   - otherwise                 → the job must resolve to a YouTubeProject
 *                                 the caller can access
 *   - inline jobs (Style-editor work that belongs to no project) → only the
 *     account whose id the DGX stamped on the job at kickoff. An inline job
 *     with no owner recorded is denied to everyone but the owner tier.
 * Every denial is a 404 so job existence never leaks.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { autopilot, AutopilotError } from "@/lib/vater/autopilot-client";
import { isVaterAdminEmail } from "@/lib/admin-auth";
import { canAccessProject, checkProjectAccess } from "@/lib/vater/project-access";
import { findJobOwnership, resolveInlineOwner } from "@/lib/vater/job-ownership";

type Ctx = { params: Promise<{ jobId: string }> };

const notFound = () =>
  NextResponse.json({ error: "Job not found" }, { status: 404 });

export async function GET(req: NextRequest, ctx: Ctx) {
  const session = await auth();
  const userId = session?.user?.id;
  const email = session?.user?.email ?? null;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { jobId } = await ctx.params;
  if (!jobId || !/^[a-zA-Z0-9_-]{8,64}$/.test(jobId)) {
    return NextResponse.json({ error: "Invalid jobId" }, { status: 400 });
  }

  if (!isVaterAdminEmail(email)) {
    const scopedProjectId = req.nextUrl.searchParams.get("projectId");
    if (scopedProjectId) {
      const access = await checkProjectAccess(scopedProjectId, userId, email);
      if (!access.ok) return notFound();
      const ownership = await findJobOwnership(jobId);
      if (
        ownership.kind !== "project" ||
        ownership.projectId !== scopedProjectId
      ) {
        return notFound();
      }
    } else {
      const ownership = await findJobOwnership(jobId);
      if (ownership.kind === "project") {
        if (!canAccessProject(ownership.projectUserId, userId, email)) {
          return notFound();
        }
      } else {
        // Inline Style-editor job — no project row behind it, so the only
        // record of who started it is the ownerId the DGX stamped at kickoff.
        // Scope on THAT (Phase 3, 2026-08-17). This used to be a bare studio
        // tier check, which meant every studio user shared one job pool.
        const inline = await resolveInlineOwner(jobId);
        if (inline.kind !== "inline" || inline.userId !== userId) {
          // Includes jobs created before the ownerId stamp: un-ownable, so
          // deniable. Failing closed is the point of the change.
          return notFound();
        }
      }
    }
  }

  try {
    const job = await autopilot.getJob(jobId);
    return NextResponse.json(job);
  } catch (err) {
    if (err instanceof AutopilotError) {
      return NextResponse.json(
        { error: "Autopilot poll failed", status: err.status, detail: err.body || err.message },
        { status: 502 },
      );
    }
    return NextResponse.json(
      { error: "Autopilot unreachable", detail: err instanceof Error ? err.message : "unknown" },
      { status: 502 },
    );
  }
}
