/**
 * POST /api/vater/youtube/[id]/scene/camera
 *
 * Sets the camera move on ONE scene: { sceneIdx, camera }.
 *
 * `camera` is one of the moves in lib/vater/project-features.ts, or null to
 * clear the override so the scene falls back to `features.cameraDefault`.
 * Per-scene overrides are the contract's `scenesJson[i].camera` (see
 * design/jelly-feature-contract-2026-08-16.md).
 *
 * Risk #1 (per-idx merge): this reads the current scene object and spreads
 * the single key on top, exactly like /scene/overlay. It never ships a
 * wholesale scenesJson replacement, so a concurrent image regen on another
 * scene can't be clobbered by a camera click.
 *
 * Unlike the overlay route this does NOT stamp `editedAt` or flip a `ready`
 * project to `editing`: camera is a compose-time prop, so nothing about the
 * already-baked final MP4 becomes stale until the user re-composes anyway —
 * and marking every dropdown change as an edit would nag them for a
 * re-render they may not want.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { canAccessProject } from "@/lib/vater/project-access";
import { isCameraMove } from "@/lib/vater/project-features";

type Ctx = { params: Promise<{ id: string }> };

interface CameraBody {
  sceneIdx?: number;
  camera?: unknown;
}

export async function POST(req: NextRequest, ctx: Ctx) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;

  let body: CameraBody;
  try {
    body = (await req.json()) as CameraBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (
    typeof body.sceneIdx !== "number" ||
    !Number.isInteger(body.sceneIdx) ||
    body.sceneIdx < 0
  ) {
    return NextResponse.json(
      { error: "sceneIdx (non-negative integer) required" },
      { status: 400 },
    );
  }

  const clearing = body.camera === null || body.camera === undefined;
  if (!clearing && !isCameraMove(body.camera)) {
    return NextResponse.json(
      { error: "camera must be one of: alternate | zoom-in | zoom-out | pan-l | pan-r | still, or null" },
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

  const scenes = Array.isArray(project.scenesJson)
    ? (project.scenesJson as unknown[])
    : [];
  if (body.sceneIdx >= scenes.length) {
    return NextResponse.json(
      {
        error: `sceneIdx ${body.sceneIdx} out of bounds (scene count: ${scenes.length})`,
      },
      { status: 400 },
    );
  }

  const currentScene = (scenes[body.sceneIdx] || {}) as Record<string, unknown>;
  const newScene: Record<string, unknown> = { ...currentScene };
  if (clearing) delete newScene.camera;
  else newScene.camera = body.camera;

  const newScenes = [...scenes];
  newScenes[body.sceneIdx] = newScene;

  await prisma.youTubeProject.update({
    where: { id },
    data: { scenesJson: newScenes as unknown as object },
  });

  return NextResponse.json({ scene: newScene });
}
