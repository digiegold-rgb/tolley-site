import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { wordCountForDuration } from "@/lib/vater/youtube-types";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const project = await prisma.youTubeProject.findUnique({ where: { id } });
  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ project });
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const body = await req.json();

  const allowed = [
    "voiceId",
    "voiceName",
    "targetDuration",
    "script",
    "sourceTitle",
    "sourceChannel",
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
  const { id } = await ctx.params;
  await prisma.youTubeProject.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
