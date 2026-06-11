/**
 * POST /api/vater/youtube/new-from-style
 *
 * Pure Prisma insert — creates an empty YouTubeProject shell tied to a
 * Style. The TubeGen-parity v2 dashboard hits this immediately after the
 * user picks a Style in StylePickerModal, before any source has been
 * chosen. The user lands in the project shell with the stepper on the
 * Title step.
 *
 * Why not `[id]/draft/`? `/api/vater/youtube/[id]/draft/` already exists
 * as the snapshot-revert system (post-generation editor). Naming this
 * collection-level endpoint `draft/` would be a confusing collision.
 *
 * Body: { styleId }
 * Returns: { project }
 *
 * Errors (no silent catches per feedback_silent_failures_leads.md):
 *   401 — unauthenticated
 *   400 — missing/invalid styleId
 *   403 — style is owned by another user
 *   404 — style not found
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

interface CreateBody {
  styleId?: string;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: CreateBody;
  try {
    body = (await req.json()) as CreateBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.styleId || typeof body.styleId !== "string") {
    return NextResponse.json(
      { error: "styleId is required" },
      { status: 400 },
    );
  }

  // Pre-validate: style must exist AND be either system or owned by this user.
  const style = await prisma.youTubeStyle.findUnique({
    where: { id: body.styleId },
    select: { id: true, userId: true, isSystem: true },
  });
  if (!style) {
    return NextResponse.json({ error: "Style not found" }, { status: 404 });
  }
  if (!style.isSystem && style.userId && style.userId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const project = await prisma.youTubeProject.create({
    data: {
      userId: session.user.id,
      styleId: style.id,
      mode: "topic",
      status: "draft",
      progress: 0,
    },
  });

  console.log(
    `[vater/new-from-style] user=${session.user.id} style=${style.id} project=${project.id}`,
  );

  return NextResponse.json({ project }, { status: 201 });
}
