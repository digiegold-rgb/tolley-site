import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { wordCountForDuration } from "@/lib/vater/youtube-types";
import { auth } from "@/auth";
import {
  canAccessProject,
  checkProjectAccess,
} from "@/lib/vater/project-access";

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

  return NextResponse.json({ project });
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;

  const access = await checkProjectAccess(id, session.user.id, session.user.email);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const body = await req.json();

  const allowed = [
    "voiceId",
    "voiceName",
    "targetDuration",
    "script",
    "sourceTitle",
    "sourceChannel",
    "customStylePrompt",
    // Publish stage (2026-08-08) — metadata staged in the Script Review
    // screen and sent verbatim to videos.insert on upload.
    "publishTitle",
    "description",
    "tags",
    "thumbnailConcept",
    // Hybrid render window: animate the first N seconds, Ken Burns the rest.
    "animUntilS",
    // Short-form promo (2026-08-09) — user-edited caption for cross-posting.
    "shortDescription",
  ];
  const data: Record<string, unknown> = {};
  for (const key of allowed) {
    if (body[key] !== undefined) data[key] = body[key];
  }

  // `tags` is a scalar list — a non-array would 500 inside Prisma, so
  // normalise here and surface the bad input instead.
  if (data.tags !== undefined) {
    if (!Array.isArray(data.tags)) {
      return NextResponse.json(
        { error: "tags must be an array of strings" },
        { status: 400 },
      );
    }
    data.tags = (data.tags as unknown[])
      .filter((t): t is string => typeof t === "string")
      .map((t) => t.trim())
      .filter(Boolean);
  }

  if (data.targetDuration) {
    data.targetWordCount = wordCountForDuration(data.targetDuration as number);
  }

  const project = await prisma.youTubeProject.update({
    where: { id },
    data,
  });

  return NextResponse.json({ project });
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;

  const access = await checkProjectAccess(id, session.user.id, session.user.email);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  await prisma.youTubeProject.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
