/**
 * GET /api/vater/youtube/[id]/scene/[idx]?v=N&variant=image|video
 *
 * Streams a single scene asset (PNG or MP4) back through the Cloudflare
 * tunnel from the DGX work dir. Used by the editor timeline + Remotion
 * Player so browsers can load per-scene assets without needing the DGX
 * bearer token.
 *
 * variant=image (default):
 *   v=0 (or missing) → original pipeline render (`scenes/NNN.png`)
 *   v=N, N>0        → regenerated version (`scenes/NNN_vN.png`)
 *
 * variant=video (for animated scenes from /vater/animate-scene):
 *   v=0 (or missing) → initial animation (`scenes/NNN.mp4`)
 *   v=N, N>0        → re-roll version (`scenes/NNN_vN.mp4`)
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { autopilot, AutopilotError } from "@/lib/vater/autopilot-client";
import { getProjectJobId } from "@/lib/vater/project-jobid-cache";
import { checkProjectAccess } from "@/lib/vater/project-access";

type Ctx = { params: Promise<{ id: string; idx: string }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, idx } = await ctx.params;
  const sceneIdx = Number.parseInt(idx, 10);
  if (!Number.isFinite(sceneIdx) || sceneIdx < 0) {
    return NextResponse.json(
      { error: "scene idx must be a non-negative integer" },
      { status: 400 },
    );
  }

  const versionParam = req.nextUrl.searchParams.get("v");
  const version =
    versionParam !== null ? Number.parseInt(versionParam, 10) : 0;
  if (!Number.isFinite(version) || version < 0) {
    return NextResponse.json(
      { error: "v must be a non-negative integer" },
      { status: 400 },
    );
  }

  const variantParam = req.nextUrl.searchParams.get("variant");
  const variant: "image" | "video" =
    variantParam === "video" ? "video" : "image";

  // Tenant isolation — 404 for both missing and foreign projects.
  const access = await checkProjectAccess(id, session.user.id, session.user.email);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  // Cached lookup — 12 scenes loading in parallel share one Prisma query
  // instead of hammering the pool cold-start 12 times. autopilotJobId is
  // immutable per project.
  const jobId = await getProjectJobId(id);
  if (!jobId) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  // fetchFile() uses autopilot-client's raw Response passthrough with
  // bearer auth baked in.
  //
  // Kind paths:
  //   image v0: /vater/file/<job>/scene/<idx>
  //   image vN: /vater/file/<job>/scene/<idx>/<version>
  //   video v0: /vater/file/<job>/scene/<idx>/video/0
  //   video vN: /vater/file/<job>/scene/<idx>/video/<version>
  let kind: string;
  if (variant === "video") {
    kind = `scene/${sceneIdx}/video/${version}`;
  } else {
    kind = version === 0 ? `scene/${sceneIdx}` : `scene/${sceneIdx}/${version}`;
  }
  const defaultContentType = variant === "video" ? "video/mp4" : "image/png";
  // Forward the browser's Range header upstream so <video> elements get
  // proper 206 Partial Content with Content-Range — without this Remotion
  // Player throws MediaPlaybackError and the scene renders blank.
  const range = req.headers.get("range");
  try {
    const upstream = await autopilot.fetchFile(jobId, kind, range);
    const headers: Record<string, string> = {
      "content-type":
        upstream.headers.get("content-type") || defaultContentType,
      "cache-control":
        version > 0
          ? "private, max-age=31536000, immutable"
          : "private, max-age=60",
      "accept-ranges": "bytes",
    };
    const passthrough = [
      "content-length",
      "content-range",
      "etag",
      "last-modified",
    ];
    for (const h of passthrough) {
      const v = upstream.headers.get(h);
      if (v) headers[h] = v;
    }
    return new NextResponse(upstream.body, {
      status: upstream.status, // preserve 200 vs 206
      headers,
    });
  } catch (err) {
    if (err instanceof AutopilotError) {
      return NextResponse.json(
        { error: err.message, upstream: err.status },
        { status: err.status === 404 ? 404 : 502 },
      );
    }
    throw err;
  }
}
