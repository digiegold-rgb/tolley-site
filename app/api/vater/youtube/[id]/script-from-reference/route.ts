/**
 * POST /api/vater/youtube/[id]/script-from-reference
 *
 * Step 2 of the Script Review intake. The project was created from a
 * reference YouTube URL (POST /api/vater/youtube kicks yt-dlp + whisper);
 * once the transcript lands, this route runs the DGX creation worker with
 * `stopAfterScript` so it writes the script and stops. No voice, no images,
 * no render — that spend waits for the human Approve click in the Script
 * Review screen (/approve-script).
 *
 * The Script Review screen fires this automatically on the poll tick that
 * first sees `transcribed`, and offers it as an explicit button otherwise.
 * Callers that arrive early get a 409 carrying the current status so they
 * can simply retry on the next tick.
 *
 * Body: {} — everything comes off the project row (style, voice, goal,
 * targetWordCount, animUntilS), set at creation time by the intake form.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AutopilotError } from "@/lib/vater/autopilot-client";
import { startRunCreation, ScriptGateError } from "@/lib/vater/script-gate";
import { auth } from "@/auth";
import { canAccessProject } from "@/lib/vater/project-access";
import { checkBudget } from "@/lib/vater/billing/check-budget";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, ctx: Ctx) {
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

  // Scripting is the only thing this run buys, but the budget gate mirrors
  // /context so a capped user is stopped before any DGX work starts.
  const budget = await checkBudget(session.user.id, "script");
  if (!budget.allow) {
    return NextResponse.json(
      { error: "Billing check failed", budget },
      { status: 402 },
    );
  }

  if (!project.transcript) {
    return NextResponse.json(
      {
        error: `Transcript not ready yet (status '${project.status}')`,
        status: project.status,
      },
      { status: 409 },
    );
  }
  // `transcribed` is the first pass. `awaiting_script_approval` is the
  // Regenerate button in the review panel — the same call, run again on a
  // script the user rejected. Nothing else may start a scripting run.
  const STARTABLE = ["transcribed", "awaiting_script_approval"];
  if (!STARTABLE.includes(project.status)) {
    return NextResponse.json(
      {
        error: `Project must be transcribed or awaiting script approval to write a script, currently '${project.status}'`,
        status: project.status,
      },
      { status: 409 },
    );
  }

  // Claim the project before calling out, so a double-click or an overlapping
  // poll tick hits the status gate above instead of kicking a second job.
  await prisma.youTubeProject.update({
    where: { id },
    data: {
      status: "extracting_principles",
      progress: 35,
      errorMessage: null,
    },
  });

  try {
    const jobId = await startRunCreation(project, { stopAfterScript: true });
    const withJob = await prisma.youTubeProject.update({
      where: { id },
      data: { autopilotJobId: jobId },
    });
    console.log(
      `[vater/script-from-reference] project=${id} job=${jobId} — stopAfterScript`,
    );
    return NextResponse.json({ project: withJob });
  } catch (err) {
    const detail =
      err instanceof AutopilotError
        ? `[${err.status}] ${err.body || err.message}`
        : err instanceof Error
          ? err.message
          : "unknown error";
    // A bad project row (no voice, deleted style) is the user's to fix, so
    // roll back to `transcribed` and let them retry. A transport failure is
    // terminal for this attempt and lands in `failed` like /context does.
    const recoverable = err instanceof ScriptGateError;
    const failed = await prisma.youTubeProject.update({
      where: { id },
      data: {
        // Hand a fixable project back exactly where it came from, so a
        // Regenerate that failed still lands on the review panel.
        status: recoverable ? project.status : "failed",
        progress: recoverable ? project.progress : 0,
        errorMessage: `script kickoff failed: ${detail}`.slice(0, 1000),
      },
    });
    return NextResponse.json(
      { error: "script kickoff failed", detail, project: failed },
      { status: recoverable ? 400 : 502 },
    );
  }
}
