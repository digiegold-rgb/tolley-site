/**
 * POST /api/vater/youtube/[id]/aspect-cut
 *
 * Asks the DGX for a 9:16 cut of a finished 16:9 video. The box reuses the
 * existing narration + captions and re-plans the framing, so this is a
 * re-render, not a new script — see the contract's
 * POST /vater/projects/{projectId}/aspect-cut.
 *
 * Body: { aspect?: "9:16" }  (9:16 is the only supported target today)
 * Returns: { jobId } on success.
 *
 * The DGX side is being built in parallel. Until it ships the box answers
 * 404, which `dgxCall` reports as `unavailable` and we turn into a 501 with
 * `{ unavailable: true }` — the UI disables the button with a "coming online"
 * tooltip rather than showing a scary error for a feature that simply isn't
 * wired yet.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { canAccessProject } from "@/lib/vater/project-access";
import { dgxCall, unavailableBody } from "@/lib/vater/dgx-feature-proxy";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;

  const body = (await req.json().catch(() => ({}))) as { aspect?: unknown };
  const aspect = body.aspect === undefined ? "9:16" : body.aspect;
  if (aspect !== "9:16") {
    return NextResponse.json(
      { error: 'aspect must be "9:16" — that is the only cut available today' },
      { status: 400 },
    );
  }

  const project = await prisma.youTubeProject.findUnique({ where: { id } });
  if (
    !project ||
    !canAccessProject(project.userId, session.user.id, session.user.email)
  ) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  // There is nothing to re-frame until the long-form exists.
  if (project.status !== "ready" || !project.finalVideoUrl) {
    return NextResponse.json(
      {
        error: `Render the video first — a vertical cut re-frames the finished one (status '${project.status}')`,
      },
      { status: 409 },
    );
  }

  const result = await dgxCall<{ jobId?: string }>(
    "POST",
    `/vater/projects/${encodeURIComponent(id)}/aspect-cut`,
    { aspect },
  );

  if (result.kind === "unavailable") {
    return NextResponse.json(
      unavailableBody("Vertical cut", result.reason),
      { status: 501 },
    );
  }
  if (result.kind === "error") {
    return NextResponse.json(
      { error: "Vertical cut failed", detail: result.body.slice(0, 400) },
      { status: 502 },
    );
  }

  console.log(`[vater/aspect-cut] project=${id} job=${result.data.jobId}`);
  return NextResponse.json({ ok: true, jobId: result.data.jobId ?? null });
}
