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
  ];
  const data: Record<string, unknown> = {};
  for (const key of allowed) {
    if (body[key] !== undefined) data[key] = body[key];
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
