/**
 * POST /api/vater/youtube/[id]/remix
 *
 * "Make another one like this." Opens a NEW draft project carrying this
 * project's setup — style (and through it the voice, art style and
 * characters), soundtrack, length targets and the feature bag (aspect,
 * captionPreset, overlays, brandKit, camera, transitions, musicMoods).
 *
 * Nothing is copied that belongs to the finished video: no script, audio,
 * scenes, thumbnail, final MP4, cost or YouTube id. Nothing is spent — this
 * is a Prisma insert, so it does not touch the DGX or the budget gate.
 *
 * The exact copy rules live in lib/vater/project-remix.ts, shared with
 * /api/vater/youtube/new-from-style so the two entry points can't drift.
 *
 * Body: {} (no options today)
 * Returns: { id, project }
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { canAccessProject } from "@/lib/vater/project-access";
import { createProjectFromStyle } from "@/lib/vater/project-remix";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, ctx: Ctx) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;

  const source = await prisma.youTubeProject.findUnique({ where: { id } });
  if (
    !source ||
    !canAccessProject(source.userId, session.user.id, session.user.email)
  ) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  // The remix belongs to whoever clicked, not to the original owner — an
  // admin remixing a customer's project gets their own draft.
  const created = await createProjectFromStyle({
    userId: session.user.id,
    source,
  });
  if (!created.ok) {
    return NextResponse.json({ error: created.error }, { status: created.status });
  }

  console.log(
    `[vater/remix] user=${session.user.id} from=${id} → project=${created.project.id}`,
  );

  return NextResponse.json(
    { id: created.project.id, project: created.project },
    { status: 201 },
  );
}
