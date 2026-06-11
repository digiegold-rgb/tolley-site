/**
 * POST /api/vater/youtube/[id]/scene/animation-plan
 *
 * Get an LLM-generated animationPrompt + fixedCamera for ONE scene,
 * without actually animating. Powers the "✨ Auto-suggest" button in
 * the SceneEditorDrawer so the user can roll a new suggestion without
 * typing (or accept it and click Animate).
 *
 * Body: { sceneIdx: number }
 * Returns: { sceneIdx, animationPrompt, fixedCamera }
 *
 * Fast (~1-3s). No state changes — pure LLM read.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { autopilot, AutopilotError } from "@/lib/vater/autopilot-client";
import type { SceneSpec } from "@/lib/vater/video-spec";
import { canAccessProject } from "@/lib/vater/project-access";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as {
    sceneIdx?: unknown;
  };
  const sceneIdx =
    typeof body.sceneIdx === "number" && Number.isFinite(body.sceneIdx)
      ? Math.floor(body.sceneIdx)
      : null;
  if (sceneIdx === null || sceneIdx < 0) {
    return NextResponse.json(
      { error: "sceneIdx must be a non-negative integer" },
      { status: 400 },
    );
  }

  const project = await prisma.youTubeProject.findUnique({
    where: { id },
    select: { userId: true, autopilotJobId: true, scenesJson: true },
  });
  if (
    !project ||
    !canAccessProject(project.userId, session.user.id, session.user.email) ||
    !project.autopilotJobId
  ) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const scenes = Array.isArray(project.scenesJson)
    ? (project.scenesJson as unknown as SceneSpec[])
    : [];
  const existing = scenes[sceneIdx] ?? ({} as SceneSpec);

  try {
    const plan = await autopilot.planSceneAnimation({
      jobId: project.autopilotJobId,
      sceneIdx,
      imagePrompt: existing.imagePrompt,
      beatText: existing.beatText,
    });
    return NextResponse.json({ ok: true, plan });
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
