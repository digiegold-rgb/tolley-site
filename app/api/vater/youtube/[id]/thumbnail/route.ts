/**
 * POST /api/vater/youtube/[id]/thumbnail — generate a 1280×720 thumbnail
 * GET  /api/vater/youtube/[id]/thumbnail — stream the thumbnail image
 *
 * POST triggers the Content Autopilot SDXL + ffmpeg text-overlay pipeline on
 * the DGX and stores the proxy-safe URL in the DB.
 *
 * GET streams the thumbnail image back through the bearer-authed DGX proxy so
 * the browser never needs direct DGX access.
 *
 * No silent catches — AutopilotError surfaces as 502 per
 * feedback_silent_failures_leads.md.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  autopilot,
  AutopilotError,
  type ThumbnailInput,
} from "@/lib/vater/autopilot-client";
import { auth } from "@/auth";
import { canAccessProject } from "@/lib/vater/project-access";
import { checkBudget } from "@/lib/vater/billing/check-budget";
import { recordUsage } from "@/lib/vater/billing/record-usage";

type Ctx = { params: Promise<{ id: string }> };

// ---------------------------------------------------------------------------
// GET — stream the stored thumbnail through the DGX proxy
// ---------------------------------------------------------------------------

export async function GET(_req: NextRequest, ctx: Ctx) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const project = await prisma.youTubeProject.findUnique({
    where: { id },
    select: { thumbnailUrl: true, autopilotJobId: true, userId: true },
  });
  if (
    !project ||
    !canAccessProject(project.userId, session.user.id, session.user.email)
  ) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }
  if (!project.autopilotJobId) {
    return NextResponse.json(
      { error: "No autopilot job — cannot fetch thumbnail" },
      { status: 404 },
    );
  }
  if (!project.thumbnailUrl) {
    return NextResponse.json(
      { error: "Thumbnail not generated yet" },
      { status: 404 },
    );
  }

  try {
    const upstream = await autopilot.fetchFile(
      project.autopilotJobId,
      "thumbnail",
    );
    if (!upstream.body) {
      return NextResponse.json(
        { error: "Upstream returned empty body" },
        { status: 502 },
      );
    }

    const headers = new Headers({
      "Content-Type":
        upstream.headers.get("content-type") || "image/jpeg",
      "Content-Disposition": "inline",
      "Cache-Control": "private, max-age=600",
    });
    const len = upstream.headers.get("content-length");
    if (len) headers.set("Content-Length", len);

    return new Response(upstream.body, { status: 200, headers });
  } catch (err) {
    if (err instanceof AutopilotError) {
      console.error(
        `[vater/thumbnail GET] project=${id} error: ${err.message}`,
      );
      return NextResponse.json(
        {
          error: "Upstream thumbnail fetch failed",
          detail: `[${err.status}] ${err.body || err.message}`,
        },
        { status: 502 },
      );
    }
    throw err;
  }
}

// ---------------------------------------------------------------------------
// POST — generate a new thumbnail via the DGX pipeline
// ---------------------------------------------------------------------------

export async function POST(_req: NextRequest, ctx: Ctx) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;

  const project = await prisma.youTubeProject.findUnique({ where: { id } });
  if (
    !project ||
    !canAccessProject(project.userId, session.user.id, session.user.email)
  ) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  if (project.status !== "ready") {
    return NextResponse.json(
      {
        error: `Project must be in 'ready' status to generate thumbnail, currently '${project.status}'`,
      },
      { status: 409 },
    );
  }

  if (!project.autopilotJobId) {
    return NextResponse.json(
      { error: "Project has no autopilotJobId — cannot generate thumbnail" },
      { status: 400 },
    );
  }

  // ── Billing gate (action "thumbnail", 100¢): block BEFORE any DGX work ──
  const budget = await checkBudget(session.user.id, "thumbnail");
  if (!budget.allow) {
    return NextResponse.json(
      { error: "Billing check failed", budget },
      { status: 402 },
    );
  }

  // Pick scene idx=2 as a representative mid-video frame if available.
  let sceneImageUrl: string | undefined;
  if (project.scenesJson) {
    const scenes = project.scenesJson as Array<{
      idx: number;
      imageUrl?: string;
    }>;
    const scene2 = scenes.find((s) => s.idx === 2);
    if (scene2?.imageUrl) {
      sceneImageUrl = scene2.imageUrl;
    }
  }

  const input: ThumbnailInput = {
    jobId: project.autopilotJobId,
    title: project.sourceTitle ?? project.topic ?? "Untitled",
    stylePreset: project.stylePreset ?? "cinematic",
    ...(sceneImageUrl ? { sceneImageUrl } : {}),
  };

  let result: { thumbnailUrl: string };
  try {
    result = await autopilot.generateThumbnail(input);
  } catch (err) {
    if (err instanceof AutopilotError) {
      console.error(
        `[vater/thumbnail] project=${id} autopilot error: ${err.message}`,
      );
      return NextResponse.json(
        {
          error: "thumbnail generation failed",
          detail: `[${err.status}] ${err.body || err.message}`,
        },
        { status: 502 },
      );
    }
    throw err;
  }

  // ── Charge only after confirmed success (failed generations never charge).
  // Each POST is a fresh generation, so the key is unique per call — it only
  // exists to make the Stripe InvoiceItem write retry-safe. try/catch: the
  // user already has their thumbnail, a billing hiccup must not 500.
  try {
    await recordUsage({
      userId: session.user.id,
      action: "thumbnail",
      projectId: id,
      idempotencyKey: `thumbnail_${id}_${Date.now()}`,
    });
  } catch (err) {
    console.error(`[vater/thumbnail] recordUsage failed project=${id}`, err);
  }

  // Store a proxy-safe URL so the frontend always goes through our route.
  // The DGX may return a filesystem path or a /vater/file/... key — either
  // way the browser uses GET /api/vater/youtube/[id]/thumbnail to stream it.
  const proxyUrl = `/api/vater/youtube/${id}/thumbnail`;

  const updated = await prisma.youTubeProject.update({
    where: { id },
    data: { thumbnailUrl: proxyUrl },
  });

  console.log(
    `[vater/thumbnail] project=${id} dgxUrl=${result.thumbnailUrl} proxyUrl=${proxyUrl}`,
  );

  return NextResponse.json({ project: updated });
}
