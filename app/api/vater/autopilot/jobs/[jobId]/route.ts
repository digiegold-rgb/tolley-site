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
 *   - unattributed jobs (inline Style-editor work that belongs to no
 *     project) → studio tier only
 * Every denial is a 404 so job existence never leaks.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { autopilot, AutopilotError } from "@/lib/vater/autopilot-client";
import { isVaterAdminEmail, isVaterStudioEmail } from "@/lib/admin-auth";
import { canAccessProject, checkProjectAccess } from "@/lib/vater/project-access";
import { findJobOwnership } from "@/lib/vater/job-ownership";

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
      } else if (!isVaterStudioEmail(email)) {
        // Inline Style-editor job with no project row behind it. Only the
        // studio tier runs those; beta customers never should.
        // NOTE: studio users are NOT scoped to each other here — see the
        // "KNOWN GAP — Phase 3" block in lib/vater/job-ownership.ts before
        // widening the studio tier past the current two-person allowlist.
        return notFound();
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
