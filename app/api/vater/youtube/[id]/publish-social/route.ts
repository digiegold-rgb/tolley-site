/**
 * POST /api/vater/youtube/[id]/publish-social
 *
 * Publish a finished project to the user's OWN connected accounts through
 * the aggregator (Zernio). Body handling lives in
 * lib/vater/socials/publish-core.ts (shared with the drip batch route).
 *
 * Only ever runs from an explicit click in the publish panel — nothing
 * schedules it, no cron touches it (feedback_no_autonomous_sends.md).
 */
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { canAccessProject } from "@/lib/vater/project-access";
import { isZernioEnabled, ZernioError } from "@/lib/vater/social-vendor/zernio";
import { parseVendorPlatforms, publishSocialPost } from "@/lib/vater/socials/publish-core";
import { wallClock } from "@/lib/vater/socials/schedule";
import { jsonSafe } from "@/lib/vater/socials/json";

export const maxDuration = 60;

type Ctx = { params: Promise<{ id: string }> };

interface Body {
  platforms?: unknown;
  caption?: unknown;
  scheduleAt?: unknown;
  timezone?: unknown;
  tiktok?: {
    privacyLevel?: unknown;
    allowComment?: unknown;
    allowDuet?: unknown;
    allowStitch?: unknown;
  };
  pinterest?: { boardId?: unknown; link?: unknown };
}

export async function POST(req: NextRequest, ctx: Ctx) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isZernioEnabled()) {
    return NextResponse.json(
      { error: "Direct social publishing is not enabled on this deployment." },
      { status: 503 },
    );
  }
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as Body;

  const wanted = parseVendorPlatforms(body.platforms);
  if (wanted.length === 0) {
    return NextResponse.json(
      { error: "Pick at least one connected platform" },
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

  let scheduledFor: string | undefined;
  let timezone: string | undefined;
  if (typeof body.scheduleAt === "string" && body.scheduleAt) {
    const when = new Date(body.scheduleAt);
    if (Number.isNaN(when.getTime()) || when.getTime() <= Date.now() + 60_000) {
      return NextResponse.json(
        { error: "scheduleAt must be an ISO timestamp at least a minute in the future" },
        { status: 400 },
      );
    }
    timezone = typeof body.timezone === "string" && body.timezone ? body.timezone : "UTC";
    try {
      scheduledFor = wallClock(when.toISOString(), timezone);
    } catch {
      timezone = "UTC";
      scheduledFor = when.toISOString().slice(0, 19);
    }
  }

  try {
    const result = await publishSocialPost({
      userId: session.user.id,
      project,
      platforms: wanted,
      caption: typeof body.caption === "string" ? body.caption : undefined,
      scheduledFor,
      timezone,
      tiktok: {
        privacyLevel: typeof body.tiktok?.privacyLevel === "string" ? body.tiktok.privacyLevel : undefined,
        allowComment: body.tiktok?.allowComment !== false,
        allowDuet: body.tiktok?.allowDuet !== false,
        allowStitch: body.tiktok?.allowStitch !== false,
      },
      pinterest: {
        boardId: typeof body.pinterest?.boardId === "string" ? body.pinterest.boardId : undefined,
        link: typeof body.pinterest?.link === "string" ? body.pinterest.link : undefined,
      },
      requestId: randomUUID(),
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json(jsonSafe({ post: result.post }));
  } catch (err) {
    if (err instanceof ZernioError) {
      let msg = err.body;
      try {
        const j = JSON.parse(err.body) as { error?: string };
        msg = j.error ?? err.body;
      } catch {
        /* raw */
      }
      const status = err.status === 409 ? 409 : err.status === 400 ? 400 : 502;
      return NextResponse.json({ error: `Publish failed: ${msg}`.slice(0, 500) }, { status });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Publish failed" },
      { status: 500 },
    );
  }
}
