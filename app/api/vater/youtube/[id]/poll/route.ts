/**
 * GET /api/vater/youtube/[id]/poll
 *
 * Thin HTTP wrapper around `syncProjectFromJob()` (lib/vater/project-sync.ts),
 * which is the poll core — it polls the Content Autopilot job tracked on a
 * `YouTubeProject` row, translates the DGX-side phase into a tolley-site-side
 * `YouTubeProjectStatus`, and on completion copies all artifacts (script,
 * audio, scenes, captions, final video) into the project row, then fires the
 * billing / notification hooks. The core was extracted verbatim on 2026-08-19
 * (Phase A4) so the Concierge lane can reuse it server-side; this route's
 * response contract is unchanged:
 *
 *   no_job / already_terminal / job_missing → 200 `{ project }`
 *   synced                                  → 200 `{ project, job }`
 *   AutopilotConfigError                    → 500 `{ error, project }`
 *   AutopilotError (non-404)                → 502 `{ error, project }`
 *
 * No silent catches — autopilot client errors bubble up as a 502 with the
 * specific endpoint that failed (per `feedback_silent_failures_leads.md`).
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  AutopilotError,
  AutopilotConfigError,
} from "@/lib/vater/autopilot-client";
import { auth } from "@/auth";
import { canAccessProject } from "@/lib/vater/project-access";
import { syncProjectFromJob } from "@/lib/vater/project-sync";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;

  const project = await prisma.youTubeProject.findUnique({ where: { id } });
  if (
    !project ||
    !canAccessProject(project.userId, session.user.id, session.user.email)
  ) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  try {
    const outcome = await syncProjectFromJob(project);
    switch (outcome.kind) {
      case "no_job":
      case "already_terminal":
      case "job_missing":
        return NextResponse.json({ project: outcome.project });
      case "synced":
        return NextResponse.json({
          project: outcome.project,
          job: outcome.job,
        });
    }
  } catch (err) {
    if (err instanceof AutopilotConfigError) {
      console.error(`[vater/poll] config error: ${err.message}`);
      return NextResponse.json(
        { error: err.message, project },
        { status: 500 },
      );
    }
    if (err instanceof AutopilotError) {
      console.error(`[vater/poll] autopilot error: ${err.message}`);
      return NextResponse.json(
        { error: err.message, project },
        { status: 502 },
      );
    }
    throw err;
  }
}
