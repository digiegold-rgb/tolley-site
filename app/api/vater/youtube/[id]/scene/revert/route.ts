/**
 * POST /api/vater/youtube/[id]/scene/revert
 *
 * Put a scene back to its still image: clears the animation clip fields so
 * the editor + compose use the Ken Burns still again. Free. The MP4 stays
 * on the DGX disk (nothing is deleted) — re-animating later writes a new
 * version. Added 2026-08-26 after a bad Kling clip could not be undone.
 *
 * Body: { sceneIdx: number }
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { SceneSpec } from "@/lib/vater/video-spec";
import { canAccessProject } from "@/lib/vater/project-access";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as { sceneIdx?: unknown };
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
    select: { id: true, userId: true, scenesJson: true, status: true },
  });
  if (
    !project ||
    !canAccessProject(project.userId, session.user.id, session.user.email)
  ) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }
  const scenes: SceneSpec[] = Array.isArray(project.scenesJson)
    ? (project.scenesJson as unknown as SceneSpec[]).slice()
    : [];
  if (sceneIdx >= scenes.length) {
    return NextResponse.json(
      { error: `sceneIdx ${sceneIdx} out of range (have ${scenes.length} scenes)` },
      { status: 400 },
    );
  }
  const existing = scenes[sceneIdx];
  if (!existing?.videoUrl) {
    return NextResponse.json({ ok: true, scene: existing, unchanged: true });
  }
  // Drop every animation field; keep prompt/motion preferences so the next
  // animate starts from the same settings.
  const {
    videoUrl: _videoUrl,
    videoVersion: _videoVersion,
    animBackend: _animBackend,
    animModel: _animModel,
    animCost: _animCost,
    animDurationSeconds: _animDurationSeconds,
    ...rest
  } = existing as SceneSpec & Record<string, unknown>;
  void _videoUrl; void _videoVersion; void _animBackend; void _animModel;
  void _animCost; void _animDurationSeconds;
  const reverted = { ...rest, mediaType: "image", animate: false } as SceneSpec;
  scenes[sceneIdx] = reverted;

  const updated = await prisma.youTubeProject.update({
    where: { id },
    data: {
      scenesJson: scenes as unknown as object,
      editedAt: new Date(),
      status: project.status === "ready" ? "editing" : project.status,
    },
    select: { id: true, status: true, editedAt: true },
  });
  return NextResponse.json({ ok: true, scene: reverted, project: updated });
}
