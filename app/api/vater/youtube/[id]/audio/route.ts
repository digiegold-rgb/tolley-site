/**
 * GET /api/vater/youtube/[id]/audio
 *
 * Streams the generated TTS audio (WAV) from the DGX through the Cloudflare
 * tunnel. Mirrors the video route pattern — bearer auth stays server-side,
 * body is streamed back to the browser without buffering.
 *
 * `project.audioUrl` is stored as `/vater/file/<jobId>/audio` by the poll
 * route. We parse the jobId out and call `autopilot.fetchFile(jobId, "audio")`.
 */
import { NextRequest, NextResponse } from "next/server";
import {
  autopilot,
  AutopilotError,
} from "@/lib/vater/autopilot-client";
import { auth } from "@/auth";
import { getProjectJobId } from "@/lib/vater/project-jobid-cache";
import { checkProjectAccess } from "@/lib/vater/project-access";

type Ctx = { params: Promise<{ id: string }> };

const AUDIO_PATH_RE = /^\/?vater\/file\/([^/]+)\/audio\/?$/;

export async function GET(req: NextRequest, ctx: Ctx) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;

  // Tenant isolation — 404 for both missing and foreign projects.
  const access = await checkProjectAccess(id, session.user.id, session.user.email);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  // Cached project lookup — shared with all the scene proxy routes.
  const jobId = await getProjectJobId(id);
  if (!jobId) {
    return NextResponse.json(
      { error: "Project has no generated audio yet" },
      { status: 404 },
    );
  }

  try {
    // Forward the Range header so Remotion's <Audio> + <Video> elements can
    // seek — matches the per-scene route. Without this the browser throws
    // MediaPlaybackError when the Player tries to load a time offset.
    const range = req.headers.get("range");
    const upstream = await autopilot.fetchFile(jobId, "audio", range);
    if (!upstream.body) {
      return NextResponse.json(
        { error: "Upstream returned empty body" },
        { status: 502 },
      );
    }

    const headers = new Headers({
      "Content-Type":
        upstream.headers.get("content-type") || "audio/wav",
      "Content-Disposition": "inline",
      "Cache-Control": "private, max-age=300",
      "Accept-Ranges": "bytes",
    });
    for (const h of ["Content-Length", "Content-Range", "ETag", "Last-Modified"]) {
      const v = upstream.headers.get(h);
      if (v) headers.set(h, v);
    }

    return new Response(upstream.body, { status: upstream.status, headers });
  } catch (err) {
    if (err instanceof AutopilotError) {
      return NextResponse.json(
        {
          error: "Upstream audio fetch failed",
          status: err.status,
          detail: err.body || err.message,
        },
        { status: 502 },
      );
    }
    return NextResponse.json(
      {
        error: "Upstream audio fetch failed",
        detail: err instanceof Error ? err.message : "unknown",
      },
      { status: 502 },
    );
  }
}
