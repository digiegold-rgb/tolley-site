/**
 * lib/vater/animate-all-finalize.ts
 *
 * Copy a finished animate-all batch's clips into the project, and bill them.
 *
 * WHY THIS IS NOT JUST A ROUTE HANDLER (2026-08-27, video #51):
 * Finalize used to live only inside the POST route, which means it only ever
 * ran if a browser tab was still open and still polling. Trey's #51 rendered
 * five clips on Modal at 14:04, the DGX logged "animate-all DONE: 5/5", his
 * page froze — and finalize never fired. Result: we paid for five clips the
 * customer never received, his project sat in `editing` (so the Library grid,
 * which shows `ready`, hid it and it "vanished"), and nothing was billed.
 *
 * A step that both delivers the goods AND records the charge must not depend
 * on a tab staying open. This module is the whole of that step, taking no
 * session, so the route can call it after auth and a server-side sweeper can
 * call it for anyone.
 *
 * IDEMPOTENT, deliberately and load-bearing: usage rows key on
 * `animall_<jobId>_<sceneIdx>` and the cost merge keys on the job id, so
 * running this twice on the same batch delivers the same clips and charges
 * nothing extra. The sweeper depends on that — it re-checks batches it may
 * already have handled.
 */
import { prisma } from "@/lib/prisma";
import { autopilot, AutopilotError } from "@/lib/vater/autopilot-client";
import type { SceneSpec } from "@/lib/vater/video-spec";
import { getAnimationPrice } from "@/lib/vater/pricing";
import { recordUsage } from "@/lib/vater/billing/record-usage";
import { mergeVideoCost } from "@/lib/vater/video-cost";

export type FinalizeOutcome =
  | {
      ok: true;
      succeeded: number;
      total: number;
      totalCost: number;
      updated: number;
      /** Newly booked this run. Zero on a repeat — see `alreadyBilledCents`. */
      chargedCents: number;
      /** Was already on the ledger from an earlier finalize. */
      alreadyBilledCents: number;
    }
  | { ok: false; status: number; error: string; upstream?: number };

interface BatchScene {
  sceneIdx: number;
  version: number;
  url: string;
  cost: number;
  backend: string;
  model: string;
  durationSeconds: number;
  quality: string;
}

/**
 * @param projectId  the project the batch belongs to
 * @param animateAllJobId  the DGX job id
 *
 * Returns a discriminated result rather than throwing, so the route maps it to
 * a status code and the sweeper can log-and-continue over a hundred projects
 * without one bad job aborting the run.
 */
export async function finalizeAnimateAll(
  projectId: string,
  animateAllJobId: string,
): Promise<FinalizeOutcome> {
  let job;
  try {
    job = await autopilot.getJob(animateAllJobId);
  } catch (err) {
    if (err instanceof AutopilotError) {
      return { ok: false, status: 502, error: err.message, upstream: err.status };
    }
    return {
      ok: false,
      status: 502,
      error: err instanceof Error ? err.message : "autopilot unreachable",
    };
  }

  if (job.status === "failed") {
    return { ok: false, status: 502, error: job.error || "animate-all job failed" };
  }
  if (job.status !== "done") {
    return { ok: false, status: 409, error: `job not done yet: status=${job.status}` };
  }

  const result =
    ((job.result as {
      scenes?: BatchScene[];
      total_cost?: number;
      succeeded?: number;
      total?: number;
    }) ?? {});

  // Read AFTER the done-check so the scenesJson merged into is as fresh as
  // possible — a batch can run for hours and single-scene animates land in the
  // same column meanwhile.
  const project = await prisma.youTubeProject.findUnique({
    where: { id: projectId },
    select: { id: true, userId: true, scenesJson: true, status: true, costJson: true },
  });
  if (!project) return { ok: false, status: 404, error: "Project not found" };

  const scenes = Array.isArray(project.scenesJson)
    ? (project.scenesJson as unknown as SceneSpec[]).slice()
    : [];

  let updatedCount = 0;
  let chargedCents = 0;
  // Charges that were ALREADY on the ledger from an earlier finalize. Tracked
  // separately so a repeat run reports "$0.00 booked" rather than re-announcing
  // money it did not move.
  let alreadyBilledCents = 0;
  for (const r of result.scenes ?? []) {
    if (r.sceneIdx < 0 || r.sceneIdx >= scenes.length) continue;
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
      motionSheet: (r as { motionSheet?: unknown }).motionSheet ?? existing.motionSheet,
      overlays: existing.overlays ?? [],
      beatText: existing.beatText ?? "",
      startS: existing.startS ?? 0,
      endS: existing.endS ?? 0,
      imageUrl: existing.imageUrl ?? "",
    };
    updatedCount++;

    // Billed to the project OWNER, never the acting caller — an admin (or a
    // cron with no session at all) must not pay for a customer's batch.
    // Legacy null-owner rows are admin-only and skip billing.
    const priceCents = getAnimationPrice(r.quality)?.priceCents ?? 0;
    if (priceCents > 0 && project.userId) {
      const billed = await recordUsage({
        userId: project.userId,
        action: "animation",
        tier: r.quality,
        projectId,
        idempotencyKey: `animall_${animateAllJobId}_${r.sceneIdx}`,
        overrideCostCents: priceCents,
      });
      if (billed.deduped) alreadyBilledCents += priceCents;
      else chargedCents += priceCents;
    } else if (priceCents <= 0) {
      console.error(
        `[vater-billing] no price for quality "${r.quality}" — scene ${r.sceneIdx} NOT charged`,
      );
    }
  }

  const mergedCost = mergeVideoCost(
    project.costJson,
    (job.result as { costs?: unknown } | null)?.costs,
    animateAllJobId,
  );

  await prisma.youTubeProject.update({
    where: { id: projectId },
    data: {
      scenesJson: scenes as unknown as object,
      editedAt: new Date(),
      status: project.status === "ready" ? "editing" : project.status,
      ...(mergedCost ? { costJson: mergedCost as unknown as object } : {}),
    },
  });

  return {
    ok: true,
    succeeded: result.succeeded ?? updatedCount,
    total: result.total ?? 0,
    totalCost: result.total_cost ?? 0,
    updated: updatedCount,
    chargedCents,
    alreadyBilledCents,
  };
}
