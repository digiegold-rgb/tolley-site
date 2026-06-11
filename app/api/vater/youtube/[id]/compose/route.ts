/**
 * POST /api/vater/youtube/[id]/compose
 *
 * Kicks the DGX to re-render final.mp4 with the current VideoSpec (built from
 * the YouTubeProject row). Returns the async jobId — the frontend then polls
 * /api/vater/youtube/[id]/poll until finalVideoUrl refreshes.
 *
 * final.mp4 is written back into the existing autopilot work dir, so the
 * existing video streaming endpoint /api/vater/youtube/[id]/video picks up
 * the new file with no URL change.
 */
import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { autopilot, AutopilotError } from "@/lib/vater/autopilot-client";
import { buildVideoSpec } from "@/lib/vater/video-spec";
import { canAccessProject } from "@/lib/vater/project-access";
import { checkBudget } from "@/lib/vater/billing/check-budget";
import { consumeRateLimit, rateLimited } from "@/lib/rate-limit";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, ctx: Ctx) {
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
      autopilotJobId: true,
      audioUrl: true,
      audioDuration: true,
      scenesJson: true,
      captionTimings: true,
      sourceTitle: true,
      topic: true,
      status: true,
    },
  });
  if (
    !project ||
    !canAccessProject(project.userId, session.user.id, session.user.email)
  ) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }
  if (!project.autopilotJobId) {
    return NextResponse.json(
      { error: "Project has no autopilot job id — nothing to re-compose" },
      { status: 409 },
    );
  }

  const spec = buildVideoSpec(project);
  if (!spec) {
    return NextResponse.json(
      { error: "Project missing audio/scenes — cannot compose" },
      { status: 409 },
    );
  }

  // ── Billing gate (action "render", 250¢): block BEFORE kicking the DGX ──
  // This route is kickoff-only — the frontend polls /poll until the compose
  // job finishes. The CHARGE happens in the poll route once the job is
  // confirmed done (idempotencyKey `render_<composeJobId>`), so failed or
  // abandoned renders never bill.
  const budget = await checkBudget(session.user.id, "render");
  if (!budget.allow) {
    return NextResponse.json(
      { error: "Billing check failed", budget },
      { status: 402 },
    );
  }

  // ── Rate limit: compose is the heaviest DGX action — 2 per 10 min ──
  const rl = await consumeRateLimit(
    `vater:compose:${session.user.id}`,
    2,
    600,
  );
  if (!rl.allowed) return rateLimited(rl);

  try {
    const job = await autopilot.composeVideo({
      jobId: project.autopilotJobId,
      projectId: project.id,
      props: spec,
    });

    // Track the compose-specific jobId so /poll observes THIS compose run,
    // not the original pipeline job which has been "done" since the initial
    // render. If the DGX reuses the input jobId, this is a no-op update.
    // If it returns a new one, the poll route now tracks the right job —
    // without this, `completedAt` gets bumped off the stale "done" status
    // and `final.mp4` never actually refreshes on disk (2026-04-22 bug).
    const nextJobId = job.jobId || project.autopilotJobId;

    // Stamp editedAt + status so the dashboard reflects "re-composing".
    await prisma.youTubeProject.update({
      where: { id },
      data: {
        editedAt: new Date(),
        status: "editing",
        autopilotJobId: nextJobId,
      },
    });

    // Bust the project-jobid cache — the file proxy routes look up
    // autopilotJobId via unstable_cache (1h TTL), so without this the
    // editor keeps fetching scenes/audio from the OLD work-dir for an
    // hour after compose flips to a new jobId. (Caused 100% editor 400s
    // on 2026-04-25 when autopilotJobId changed mid-session.)
    revalidateTag("vater-youtube-project", "max");

    return NextResponse.json({ ok: true, jobId: nextJobId });
  } catch (err) {
    if (err instanceof AutopilotError) {
      return NextResponse.json(
        { error: err.message, upstream: err.status },
        { status: 502 },
      );
    }
    throw err;
  }
}
