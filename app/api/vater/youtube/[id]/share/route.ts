/**
 * POST /api/vater/youtube/[id]/share
 *
 * Queue a social upload for the project. Writes a SocialShareJob row and
 * returns the queued job id. The ACTUAL upload to the platform API is not
 * yet implemented — that's a per-platform integration (YouTube Data API,
 * TikTok Content Posting, FB Graph, IG Graph, Pinterest, X API) and each
 * is ~half a day of OAuth + upload work.
 *
 * The UI gets a clear "queued — posting integration coming soon" signal
 * so the user knows what was saved and what's pending.
 *
 * Body: { platform, title, description, hashtags?, thumbnailUrl? }
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { canAccessProject } from "@/lib/vater/project-access";
import { SUPPORTED_PLATFORMS } from "../../../social-accounts/route";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as {
    platform?: unknown;
    title?: unknown;
    description?: unknown;
    hashtags?: unknown;
    thumbnailUrl?: unknown;
  };

  if (
    typeof body.platform !== "string" ||
    !(SUPPORTED_PLATFORMS as readonly string[]).includes(body.platform)
  ) {
    return NextResponse.json(
      {
        error: `platform required, one of: ${SUPPORTED_PLATFORMS.join(", ")}`,
      },
      { status: 400 },
    );
  }

  const project = await prisma.youTubeProject.findUnique({
    where: { id },
    select: { id: true, userId: true, status: true, finalVideoUrl: true },
  });
  if (
    !project ||
    !canAccessProject(project.userId, session.user.id, session.user.email)
  ) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }
  if (project.status !== "ready" || !project.finalVideoUrl) {
    return NextResponse.json(
      {
        error:
          "Project isn't finished yet — wait for the final MP4 to render, then share.",
      },
      { status: 409 },
    );
  }

  const account = await prisma.socialAccount.findUnique({
    where: {
      userId_platform: {
        userId: session.user.id,
        platform: body.platform,
      },
    },
    select: { id: true, status: true },
  });
  if (!account) {
    return NextResponse.json(
      {
        error: "NO_CREDENTIALS",
        platform: body.platform,
        connectUrl: `/vater/youtube/social-accounts?connect=${body.platform}`,
        message: `You haven't connected ${body.platform} yet. Click Connect to add credentials.`,
      },
      { status: 412 },
    );
  }

  // Record the intent. Actual posting is a separate worker (not yet wired).
  const job = await prisma.socialShareJob.create({
    data: {
      userId: session.user.id,
      projectId: project.id,
      platform: body.platform,
      status: "queued",
      title: typeof body.title === "string" ? body.title : null,
      description:
        typeof body.description === "string" ? body.description : null,
      hashtags: Array.isArray(body.hashtags)
        ? body.hashtags
            .filter((h): h is string => typeof h === "string")
            .slice(0, 15)
        : [],
      thumbnailUrl:
        typeof body.thumbnailUrl === "string" ? body.thumbnailUrl : null,
    },
    select: {
      id: true,
      platform: true,
      status: true,
      queuedAt: true,
    },
  });

  return NextResponse.json({
    ok: true,
    job,
    note:
      "Queued. Actual posting to " +
      body.platform +
      " requires the upload worker (coming soon). Your metadata is saved and will be used when posting ships.",
  });
}
