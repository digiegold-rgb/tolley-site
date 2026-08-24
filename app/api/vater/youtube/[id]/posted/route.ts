/**
 * PATCH /api/vater/youtube/[id]/posted
 *
 * Customer mark / unmark for "Posted to YouTube" on a finished Library item.
 * Used when the video went up via VidIQ or a manual YouTube Studio upload —
 * in-app OAuth publish already sets youtubeVideoId / publishedAt, which the
 * Library treats as posted without this call.
 *
 * Unmark is safe: we only flip settingsJson.postedToYoutube. An in-app
 * youtubeVideoId is left alone so "Open in YouTube Studio" still deep-links.
 *
 * Body: { posted: boolean }
 * → 200 { ok, posted, project }
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canEditProjectAsync } from "@/lib/vater/project-access";
import {
  applyPostedToYoutube,
  isPostedToYoutube,
} from "@/lib/vater/youtube-posted";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const FINISHED_STATUSES = new Set(["ready", "editing"]);

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;

  let body: { posted?: unknown };
  try {
    body = (await req.json()) as { posted?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (typeof body.posted !== "boolean") {
    return NextResponse.json(
      { error: "posted must be a boolean" },
      { status: 400 },
    );
  }

  const project = await prisma.youTubeProject.findUnique({ where: { id } });
  if (
    !project ||
    !(await canEditProjectAsync(
      project.userId,
      session.user.id,
      session.user.email,
    ))
  ) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  if (!FINISHED_STATUSES.has(project.status)) {
    return NextResponse.json(
      {
        error:
          "Only finished videos can be marked as posted to YouTube. Finish the render first.",
      },
      { status: 409 },
    );
  }

  const updated = await prisma.youTubeProject.update({
    where: { id },
    data: {
      settingsJson: applyPostedToYoutube(project.settingsJson, body.posted) as object,
    },
  });

  return NextResponse.json({
    ok: true,
    posted: isPostedToYoutube(updated),
    project: updated,
  });
}
