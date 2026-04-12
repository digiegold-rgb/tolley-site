/**
 * GET /api/vater/youtube/[id]/video
 *
 * Streams the final MP4 from the DGX through the Cloudflare tunnel.
 *
 * `project.finalVideoUrl` is a path returned by vater.py like
 *   `/vater/file/<jobId>/video`
 * We re-wrap it via `autopilot.fetchFile(jobId, "video")` so the bearer
 * stays server-side. The body is streamed back to the browser without
 * buffering.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  autopilot,
  AutopilotError,
} from "@/lib/vater/autopilot-client";

type Ctx = { params: Promise<{ id: string }> };

const VIDEO_PATH_RE = /^\/?vater\/file\/([^/]+)\/video\/?$/;

export async function GET(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const project = await prisma.youTubeProject.findUnique({
    where: { id },
    select: {
      finalVideoUrl: true,
      autopilotJobId: true,
      status: true,
      sourceTitle: true,
      topic: true,
    },
  });
  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const download = req.nextUrl.searchParams.get("download") === "1";

  // Resolve a jobId we can call /vater/file/<jobId>/video with.
  let jobId: string | null = null;
  if (project.finalVideoUrl) {
    const m = project.finalVideoUrl.match(VIDEO_PATH_RE);
    if (m) jobId = m[1];
  }
  if (!jobId && project.autopilotJobId) {
    jobId = project.autopilotJobId;
  }
  if (!jobId) {
    return NextResponse.json(
      { error: "Project has no rendered video yet" },
      { status: 404 },
    );
  }

  try {
    const upstream = await autopilot.fetchFile(jobId, "video");
    if (!upstream.body) {
      return NextResponse.json(
        { error: "Upstream returned empty body" },
        { status: 502 },
      );
    }

    const title =
      (project.sourceTitle || project.topic || "vater-video")
        .replace(/[^a-zA-Z0-9._-]+/g, "-")
        .replace(/^-+|-+$/g, "") || "vater-video";
    const filename = `${title}-${id.slice(-8)}.mp4`;
    const headers = new Headers({
      "Content-Type":
        upstream.headers.get("content-type") || "video/mp4",
      "Content-Disposition": download
        ? `attachment; filename="${filename}"`
        : "inline",
      "Cache-Control": "private, max-age=300",
    });
    const len = upstream.headers.get("content-length");
    if (len) headers.set("Content-Length", len);

    return new Response(upstream.body, { status: 200, headers });
  } catch (err) {
    if (err instanceof AutopilotError) {
      return NextResponse.json(
        {
          error: "Upstream video fetch failed",
          status: err.status,
          detail: err.body || err.message,
        },
        { status: 502 },
      );
    }
    return NextResponse.json(
      {
        error: "Upstream video fetch failed",
        detail: err instanceof Error ? err.message : "unknown",
      },
      { status: 502 },
    );
  }
}
