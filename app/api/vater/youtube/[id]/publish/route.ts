/**
 * POST /api/vater/youtube/[id]/publish
 *
 * Uploads a finished project to the user's connected YouTube channel.
 *
 * This route only ever runs from an explicit click in the publish panel —
 * nothing schedules it, no cron touches it (feedback_no_autonomous_sends.md).
 * It refuses to guess: the project must be `ready`, have a final video, and
 * have a staged title AND description. Those are the things a human reviews.
 *
 * Body: { privacyStatus?: "public" | "unlisted" | "private" }  (default public)
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { canAccessProject } from "@/lib/vater/project-access";
import { autopilot, AutopilotError } from "@/lib/vater/autopilot-client";
import {
  uploadVideoToYouTube,
  YouTubeUploadError,
  isPrivacyStatus,
  isFuturePublishAt,
  type PrivacyStatus,
} from "@/lib/vater/youtube-upload";

// Fetching a 40-80MB final + pushing it to Google comfortably exceeds the
// default 60s budget.
export const maxDuration = 300;

type Ctx = { params: Promise<{ id: string }> };

interface PublishBody {
  privacyStatus?: unknown;
  /** ISO timestamp. Present = schedule instead of publishing now; the video
   *  is uploaded PRIVATE and YouTube flips it public at that moment. */
  publishAt?: unknown;
}

export async function POST(req: NextRequest, ctx: Ctx) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;

  const body = (await req.json().catch(() => ({}))) as PublishBody;
  const privacyStatus: PrivacyStatus = isPrivacyStatus(body.privacyStatus)
    ? body.privacyStatus
    : "public";

  // Reject a past timestamp loudly. YouTube would accept it and publish
  // immediately — the exact opposite of what "schedule" means to the person
  // who clicked it.
  const wantsSchedule =
    body.publishAt !== undefined &&
    body.publishAt !== null &&
    body.publishAt !== "";
  if (wantsSchedule && !isFuturePublishAt(body.publishAt)) {
    return NextResponse.json(
      {
        error:
          "publishAt must be an ISO timestamp in the future — a past time would publish the video immediately",
      },
      { status: 400 },
    );
  }
  const publishAt = wantsSchedule ? (body.publishAt as string) : undefined;

  const project = await prisma.youTubeProject.findUnique({ where: { id } });
  if (
    !project ||
    !canAccessProject(project.userId, session.user.id, session.user.email)
  ) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  if (project.youtubeVideoId) {
    return NextResponse.json(
      {
        error: "Already published",
        videoId: project.youtubeVideoId,
        url: `https://youtu.be/${project.youtubeVideoId}`,
      },
      { status: 409 },
    );
  }
  if (project.status !== "ready" || !project.finalVideoUrl) {
    return NextResponse.json(
      {
        error: `Project is not finished yet (status '${project.status}')`,
      },
      { status: 409 },
    );
  }
  if (!project.publishTitle?.trim() || !project.description?.trim()) {
    return NextResponse.json(
      {
        error:
          "Set a title and description in the publish panel before uploading",
      },
      { status: 400 },
    );
  }

  // Blob-hosted finals are a plain public CDN fetch; legacy finals still sit
  // behind the DGX tunnel and need the server-side bearer.
  let media: Response;
  try {
    media = project.finalVideoUrl.startsWith("https://")
      ? await fetch(project.finalVideoUrl, {
          signal: AbortSignal.timeout(120_000),
        })
      : await autopilot.fetchFile(project.autopilotJobId ?? "", "video");
  } catch (err) {
    const detail =
      err instanceof AutopilotError
        ? `[${err.status}] ${err.body || err.message}`
        : err instanceof Error
          ? err.message
          : "unknown error";
    return NextResponse.json(
      { error: "Could not fetch the final video", detail },
      { status: 502 },
    );
  }

  // Custom thumbnail, when one was generated. Fetched from the DGX rather
  // than through our own /thumbnail proxy, which would need a session cookie
  // this server-to-server request doesn't carry.
  let thumbnail: Response | null = null;
  if (project.thumbnailUrl && project.autopilotJobId) {
    try {
      thumbnail = await autopilot.fetchFile(project.autopilotJobId, "thumbnail");
    } catch (err) {
      // Never fatal — the video uploads with YouTube's auto-generated frame.
      console.warn(
        `[vater/publish] project=${id} thumbnail fetch failed:`,
        err instanceof Error ? err.message : err,
      );
    }
  }

  try {
    const result = await uploadVideoToYouTube({
      userId: project.userId ?? session.user.id,
      title: project.publishTitle.trim(),
      description: project.description.trim(),
      tags: project.tags,
      privacyStatus,
      media,
      thumbnail,
      publishAt,
    });

    // `publishedAt` records when WE handed it to YouTube — that's what the
    // receipt and the library timeline mean by "uploaded". The scheduled
    // go-live is a separate fact and lives in the feature bag so the panel can
    // render "Scheduled for …" without a schema change.
    const updated = await prisma.youTubeProject.update({
      where: { id },
      data: {
        youtubeVideoId: result.videoId,
        publishedAt: new Date(),
        publishedTo: project.publishedTo.includes("youtube")
          ? project.publishedTo
          : [...project.publishedTo, "youtube"],
        ...(result.publishAt
          ? {
              settingsJson: {
                ...(project.settingsJson &&
                typeof project.settingsJson === "object" &&
                !Array.isArray(project.settingsJson)
                  ? (project.settingsJson as Record<string, unknown>)
                  : {}),
                publishAt: result.publishAt,
              },
            }
          : {}),
      },
    });

    console.log(
      `[vater/publish] project=${id} → https://youtu.be/${result.videoId} (${
        result.publishAt ? `scheduled ${result.publishAt}` : privacyStatus
      })`,
    );

    return NextResponse.json({
      ok: true,
      videoId: result.videoId,
      url: result.url,
      publishAt: result.publishAt ?? null,
      project: updated,
    });
  } catch (err) {
    const detail =
      err instanceof YouTubeUploadError || err instanceof Error
        ? err.message
        : String(err);
    console.error(`[vater/publish] project=${id} upload failed: ${detail}`);
    return NextResponse.json(
      { error: "YouTube upload failed", detail },
      { status: 502 },
    );
  }
}
