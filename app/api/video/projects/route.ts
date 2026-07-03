import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { emptyProject, normalize } from "@/lib/video-editor/defaults";
import type { Project } from "@/lib/video-editor/types";

/** GET /api/video/projects — list current user's projects */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const projects = await prisma.videoProject.findMany({
    where: { userId: session.user.id },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      name: true,
      fps: true,
      width: true,
      height: true,
      durationS: true,
      status: true,
      outputBlobUrl: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return NextResponse.json({ projects });
}

/** POST /api/video/projects — create a new project */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    name?: string;
    fps?: number;
    width?: number;
    height?: number;
    state?: Project;
  };

  const state = body.state
    ? normalize(body.state)
    : emptyProject({ fps: body.fps, width: body.width, height: body.height });

  const project = await prisma.videoProject.create({
    data: {
      userId: session.user.id,
      name: (body.name || "Untitled project").slice(0, 200),
      fps: state.fps,
      width: state.width,
      height: state.height,
      durationS: state.durationS,
      state: state as object,
    },
  });

  return NextResponse.json({ project });
}
