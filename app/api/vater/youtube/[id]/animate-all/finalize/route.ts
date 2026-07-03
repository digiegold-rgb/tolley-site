/**
 * POST /api/vater/youtube/[id]/animate-all/finalize?animateAllJobId=<id>
 *
 * Once the DGX animate-all job reports status=done, the frontend calls this
 * to copy the per-scene MP4 results into Prisma's scenesJson.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { autopilot, AutopilotError } from "@/lib/vater/autopilot-client";
import type { SceneSpec } from "@/lib/vater/video-spec";
import { canAccessProject } from "@/lib/vater/project-access";
import { getAnimationPrice } from "@/lib/vater/pricing";
import { recordUsage } from "@/lib/vater/billing/record-usage";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const animateAllJobId = req.nextUrl.searchParams.get("animateAllJobId");
  if (!animateAllJobId) {
    return NextResponse.json({ error: "animateAllJobId required" }, { status: 400 });
  }

  let job;
  try {
    job = await autopilot.getJob(animateAllJobId);
  } catch (err) {
    if (err instanceof AutopilotError) {
      return NextResponse.json(
        { error: err.message, upstream: err.status },
        { status: 502 },
      );
    }
    throw err;
  }

  if (job.status === "failed") {
    return NextResponse.json(
      { error: job.error || "animate-all job failed", animateAllJobId },
      { status: 502 },
    );
  }
  if (job.status !== "done") {
    return NextResponse.json(
      { error: `job not done yet: status=${job.status}`, animateAllJobId },
      { status: 409 },
    );
  }

  const result = (job.result as {
    scenes?: Array<{
      sceneIdx: number;
      version: number;
      url: string;
      cost: number;
      backend: string;
      model: string;
      durationSeconds: number;
      quality: string;
    }>;
    total_cost?: number;
    succeeded?: number;
    total?: number;
  }) ?? {};

  // Fetched AFTER the job-done check so the scenesJson we merge into is as
  // fresh as possible (the batch can run 1-2 hours — see scene/animate race).
  const project = await prisma.youTubeProject.findUnique({
    where: { id },
    select: { id: true, userId: true, scenesJson: true, status: true },
  });
  if (
    !project ||
    !canAccessProject(project.userId, session.user.id, session.user.email)
  ) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const scenes = Array.isArray(project.scenesJson)
    ? (project.scenesJson as unknown as SceneSpec[]).slice()
    : [];

  let updatedCount = 0;
  let chargedCents = 0;
  for (const r of result.scenes ?? []) {
    if (r.sceneIdx >= 0 && r.sceneIdx < scenes.length) {
      const existing = scenes[r.sceneIdx] ?? ({} as SceneSpec);
      scenes[r.sceneIdx] = {
        ...existing,
        idx: r.sceneIdx,
        mediaType: "video",
        videoUrl: r.url,
        videoVersion: r.version,
        animate: true,
        animQuality: r.quality as SceneSpec["animQuality"],
        animCost: r.cost,
        animBackend: r.backend as SceneSpec["animBackend"],
        animModel: r.model,
        animDurationSeconds: r.durationSeconds,
        overlays: existing.overlays ?? [],
        beatText: existing.beatText ?? "",
        startS: existing.startS ?? 0,
        endS: existing.endS ?? 0,
        imageUrl: existing.imageUrl ?? "",
      };
      updatedCount++;

      // Charge per succeeded scene at the customer price for the tier the
      // DGX actually used. Idempotent on (jobId, sceneIdx) — finalize can be
      // re-called safely without double-charging. Billed to the project OWNER,
      // not the acting session — an admin assisting a customer must not pay
      // for the customer's batch (mirrors poll/route.ts:490). Legacy null-owner
      // projects are admin-only and skip billing.
      const price = getAnimationPrice(r.quality);
      const priceCents = price?.priceCents ?? 0;
      if (priceCents > 0 && project.userId) {
        await recordUsage({
          userId: project.userId,
          action: "animation",
          tier: r.quality,
          projectId: id,
          idempotencyKey: `animall_${animateAllJobId}_${r.sceneIdx}`,
          overrideCostCents: priceCents,
        });
        chargedCents += priceCents;
      } else if (priceCents <= 0) {
        console.error(
          `[vater-billing] no price for quality "${r.quality}" — scene ${r.sceneIdx} NOT charged`,
        );
      }
    }
  }

  await prisma.youTubeProject.update({
    where: { id },
    data: {
      scenesJson: scenes as unknown as object,
      editedAt: new Date(),
      status: project.status === "ready" ? "editing" : project.status,
    },
  });

  return NextResponse.json({
    ok: true,
    succeeded: result.succeeded ?? updatedCount,
    total: result.total ?? 0,
    totalCost: result.total_cost ?? 0,
    updated: updatedCount,
    chargedCents,
  });
}
