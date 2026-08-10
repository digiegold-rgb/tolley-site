/**
 * POST /api/vater/youtube/[id]/approve-script
 *
 * The human gate. Nothing in the pipeline spends money on voice, images, or
 * animation until this route runs — the reference-video intake stops the DGX
 * worker at `script_ready`, the project rests in `awaiting_script_approval`,
 * and only an explicit Approve click in the Script Review screen starts the
 * render (per feedback_no_autonomous_sends.md: Jared pulls every trigger).
 *
 * Persists the approved text + `scriptApprovedAt`, then re-runs the creation
 * worker with the text as `scriptOverride` so it skips principle extraction
 * and script generation and goes straight to audio → captions → scenes →
 * compose.
 *
 * Body: { script?: string } — the edited script. Falls back to the script
 * already on the row when omitted (approve-as-is).
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AutopilotError } from "@/lib/vater/autopilot-client";
import { startRunCreation, ScriptGateError } from "@/lib/vater/script-gate";
import { auth } from "@/auth";
import { canAccessProject } from "@/lib/vater/project-access";
import { checkBudget } from "@/lib/vater/billing/check-budget";
import { appendScriptVersion } from "@/lib/vater/script-versions";

type Ctx = { params: Promise<{ id: string }> };

interface ApproveBody {
  script?: string;
}

export async function POST(req: NextRequest, ctx: Ctx) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;

  let body: ApproveBody;
  try {
    body = (await req.json()) as ApproveBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const project = await prisma.youTubeProject.findUnique({ where: { id } });
  if (
    !project ||
    !canAccessProject(project.userId, session.user.id, session.user.email)
  ) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  // Same gate as /context: the render generates scene images, so check the
  // budget at one scene. Actual charges land in the poll route on completion.
  const budget = await checkBudget(session.user.id, "scene");
  if (!budget.allow) {
    return NextResponse.json(
      { error: "Billing check failed", budget },
      { status: 402 },
    );
  }

  const script =
    typeof body.script === "string" && body.script.trim()
      ? body.script.trim()
      : (project.script ?? "").trim();
  if (!script) {
    return NextResponse.json(
      { error: "No script to approve — write or generate one first" },
      { status: 400 },
    );
  }

  if (
    project.status !== "awaiting_script_approval" &&
    project.status !== "scripted"
  ) {
    return NextResponse.json(
      {
        error: `Project must be awaiting script approval, currently '${project.status}'`,
        status: project.status,
      },
      { status: 409 },
    );
  }

  const wordCount = script.split(/\s+/).filter(Boolean).length;

  // Stamp the approval + claim the row before calling out. `scriptApprovedAt`
  // also tells the poll route the script is human-owned, so a late re-poll of
  // the finished script job can never overwrite the approved text.
  const approved = await prisma.youTubeProject.update({
    where: { id },
    data: {
      script,
      scriptVersions: appendScriptVersion(
        project.scriptVersions,
        "approved",
        script,
      ),
      scriptApprovedAt: new Date(),
      targetWordCount: wordCount,
      scriptMeta: {
        wordCount,
        targetWordCount: wordCount,
        source: "user-supplied",
      },
      status: "scripted",
      progress: 30,
      errorMessage: null,
    },
  });

  try {
    const jobId = await startRunCreation(approved, { scriptOverride: script });
    const withJob = await prisma.youTubeProject.update({
      where: { id },
      data: { autopilotJobId: jobId },
    });
    console.log(
      `[vater/approve-script] project=${id} job=${jobId} — ${wordCount} words approved, render started`,
    );
    return NextResponse.json({ project: withJob });
  } catch (err) {
    const detail =
      err instanceof AutopilotError
        ? `[${err.status}] ${err.body || err.message}`
        : err instanceof Error
          ? err.message
          : "unknown error";
    // The approval itself stands (the edited script is saved); only the
    // render kickoff failed. A fixable project problem goes back to the gate
    // so the user can correct it and click Approve again.
    const recoverable = err instanceof ScriptGateError;
    const failed = await prisma.youTubeProject.update({
      where: { id },
      data: {
        status: recoverable ? "awaiting_script_approval" : "failed",
        errorMessage: `render kickoff failed: ${detail}`.slice(0, 1000),
      },
    });
    return NextResponse.json(
      { error: "render kickoff failed", detail, project: failed },
      { status: recoverable ? 400 : 502 },
    );
  }
}
