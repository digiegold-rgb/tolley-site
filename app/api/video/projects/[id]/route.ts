import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { normalize } from "@/lib/video-editor/defaults";
import type { Project } from "@/lib/video-editor/types";

type RouteContext = { params: Promise<{ id: string }> };

async function getOwnedProject(projectId: string, userId: string) {
  return prisma.videoProject.findFirst({
    where: { id: projectId, userId },
  });
}

/** GET /api/video/projects/[id] */
export async function GET(_req: NextRequest, ctx: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const project = await getOwnedProject(id, session.user.id);
  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ project });
}

/** PATCH /api/video/projects/[id] — update name and/or state */
export async function PATCH(req: NextRequest, ctx: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const existing = await getOwnedProject(id, session.user.id);
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    name?: string;
    state?: Project;
  };

  const data: Record<string, unknown> = {};
  if (typeof body.name === "string") data.name = body.name.slice(0, 200);
  if (body.state) {
    const state = normalize(body.state);
    data.state = state as object;
    data.fps = state.fps;
    data.width = state.width;
    data.height = state.height;
    data.durationS = state.durationS;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const project = await prisma.videoProject.update({
    where: { id },
    data,
  });

  return NextResponse.json({ project });
}

/** DELETE /api/video/projects/[id] */
export async function DELETE(_req: NextRequest, ctx: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const existing = await getOwnedProject(id, session.user.id);
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  await prisma.videoProject.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
