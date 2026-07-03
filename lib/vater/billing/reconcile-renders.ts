/**
 * lib/vater/billing/reconcile-renders.ts
 *
 * Backfill charges for completed-but-unbilled work whose charge normally only
 * lands when the CLIENT drives it to completion:
 *
 *   1. Compose renders ($2.50) — the compose route gates the budget, kicks a
 *      DGX compose job, and swaps `project.autopilotJobId` to it, but the
 *      `render_<jobId>` charge is recorded by the poll route only once the
 *      client polls to done. Tab closed after kickoff → GPU spent, never billed.
 *   2. Batch animations (`animall_<jobId>_<idx>`) — the animate-all route kicks
 *      a Modal batch and returns the `animateAllJobId`; the per-scene charge is
 *      recorded only when the client calls /animate-all/finalize. Tab closed
 *      after kickoff → Modal spent, never billed. The batch job id is persisted
 *      on the project (`animateAllJobId`, added 2026-07-02) precisely so this
 *      reconciler has an anchor to find it.
 *
 * Both paths re-record with the EXACT same idempotency key the client path
 * would use, so whichever runs first wins and double-billing is impossible.
 *
 * Scope + safety:
 *   - Compose: only compose-shaped done jobs (finalVideoUrl present, but no
 *     script / transcript / scenes — the exact disambiguation poll/route.ts:459
 *     uses). Run-creation jobs carry script+transcript+scenes and are billed
 *     piecemeal by the poll route, so they are skipped here.
 *   - Batch: only scenes the DGX actually returned in `result.scenes`, at the
 *     customer price for the tier it used, skipping tiers with no price.
 *   - Charges the project OWNER (project.userId), never the admin. Legacy
 *     null-owner rows are excluded by the query.
 *   - Skips anything ambiguous / not-done / vanished (404); logs skips.
 *   - Idempotent: re-records are no-ops via recordUsage's idempotencyKey.
 */

import { prisma } from "@/lib/prisma";
import { autopilot, AutopilotError } from "@/lib/vater/autopilot-client";
import { FLAT_ACTION_PRICES, getAnimationPrice } from "@/lib/vater/pricing";
import { recordUsage } from "./record-usage";

/** Statuses a compose-abandoned project can be parked in. compose/route.ts
 *  stamps "editing" at kickoff; if the client never polls to done it stays
 *  there. We also scan a couple of adjacent in-flight states defensively. */
const CANDIDATE_STATUSES = ["editing", "composing_video", "ready"] as const;

export interface ReconcileHit {
  projectId: string;
  userId: string;
  jobId: string;
  action: "render" | "animation";
  idempotencyKey: string;
  costCents: number;
  billed: boolean;
}

export interface ReconcileRendersResult {
  scanned: number;
  hits: ReconcileHit[];
  skipped: number;
  errors: Array<{ projectId: string; error: string }>;
}

interface ReconcileOptions {
  /** When true, find + report unbilled work but do NOT record any charge. */
  dryRun?: boolean;
  /** Max projects to query against the DGX per run, per pass (bounds DGX load). */
  limit?: number;
  /** Only consider projects touched within this many days (default 21). */
  withinDays?: number;
  /** Owner userIds to report-but-not-bill (e.g. the admin's own account). */
  skipBillingForUserIds?: string[];
}

/** Compose-shape check — mirrors poll/route.ts's render disambiguation. */
function isComposeOnlyResult(result: unknown): boolean {
  if (!result || typeof result !== "object") return false;
  const r = result as {
    finalVideoUrl?: unknown;
    finalVideoPath?: unknown;
    script?: unknown;
    transcript?: unknown;
    scenes?: unknown;
    scenesJson?: unknown;
  };
  const hasFinal = Boolean(r.finalVideoUrl || r.finalVideoPath);
  if (!hasFinal) return false;
  if (r.script || r.transcript) return false;
  if (Array.isArray(r.scenes) && r.scenes.length > 0) return false;
  if (Array.isArray(r.scenesJson) && r.scenesJson.length > 0) return false;
  return true;
}

type BatchScene = { sceneIdx: number; quality: string };

/** Extract the per-scene results from a done animate-all job. Shape mirrors
 *  animate-all/finalize/route.ts (`result.scenes[]`). */
function batchScenes(result: unknown): BatchScene[] {
  if (!result || typeof result !== "object") return [];
  const scenes = (result as { scenes?: unknown }).scenes;
  if (!Array.isArray(scenes)) return [];
  return scenes
    .filter(
      (s): s is { sceneIdx: number; quality: string } =>
        !!s &&
        typeof s === "object" &&
        typeof (s as { sceneIdx?: unknown }).sceneIdx === "number" &&
        typeof (s as { quality?: unknown }).quality === "string",
    )
    .map((s) => ({ sceneIdx: s.sceneIdx, quality: s.quality }));
}

export async function reconcileUnbilledRenders(
  opts: ReconcileOptions = {},
): Promise<ReconcileRendersResult> {
  const {
    dryRun = false,
    limit = 150,
    withinDays = 21,
    skipBillingForUserIds = [],
  } = opts;

  const renderCents = FLAT_ACTION_PRICES.render.priceCents;
  const skipBillSet = new Set(skipBillingForUserIds);
  const since = new Date(Date.now() - withinDays * 24 * 60 * 60 * 1000);

  const result: ReconcileRendersResult = {
    scanned: 0,
    hits: [],
    skipped: 0,
    errors: [],
  };

  async function bill(
    hit: ReconcileHit,
    action: "render" | "animation",
    tier?: string,
  ) {
    const holdBilling = skipBillSet.has(hit.userId);
    if (!dryRun && !holdBilling) {
      try {
        await recordUsage({
          userId: hit.userId,
          action,
          tier: tier ?? null,
          projectId: hit.projectId,
          idempotencyKey: hit.idempotencyKey,
          overrideCostCents: hit.costCents,
        });
        hit.billed = true;
        console.log(
          `[vater-reconcile] backfilled ${action} project=${hit.projectId} key=${hit.idempotencyKey} user=${hit.userId} ${hit.costCents}¢`,
        );
      } catch (err) {
        result.errors.push({
          projectId: hit.projectId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
    result.hits.push(hit);
  }

  // ── Pass 1: compose renders (autopilotJobId anchor) ──────────────────────
  const composeCandidates = await prisma.youTubeProject.findMany({
    where: {
      autopilotJobId: { not: null },
      userId: { not: null },
      status: { in: [...CANDIDATE_STATUSES] },
      editedAt: { gte: since },
    },
    select: { id: true, userId: true, autopilotJobId: true },
    orderBy: { editedAt: "desc" },
    take: limit,
  });

  for (const project of composeCandidates) {
    result.scanned++;
    const jobId = project.autopilotJobId;
    const userId = project.userId;
    if (!jobId || !userId) {
      result.skipped++;
      continue;
    }

    const key = `render_${jobId}`;
    const already = await prisma.vaterUsage.findUnique({
      where: { idempotencyKey: key },
      select: { id: true },
    });
    if (already) {
      result.skipped++;
      continue;
    }

    let job;
    try {
      job = await autopilot.getJob(jobId);
    } catch (err) {
      if (err instanceof AutopilotError && err.status === 404) {
        result.skipped++;
        continue;
      }
      result.errors.push({
        projectId: project.id,
        error: err instanceof Error ? err.message : String(err),
      });
      continue;
    }

    if (job.status !== "done" || !isComposeOnlyResult(job.result)) {
      result.skipped++;
      continue;
    }

    await bill(
      {
        projectId: project.id,
        userId,
        jobId,
        action: "render",
        idempotencyKey: key,
        costCents: renderCents,
        billed: false,
      },
      "render",
    );
  }

  // ── Pass 2: batch animations (animateAllJobId anchor) ────────────────────
  const batchCandidates = await prisma.youTubeProject.findMany({
    where: {
      animateAllJobId: { not: null },
      userId: { not: null },
      animateAllStartedAt: { gte: since },
    },
    select: { id: true, userId: true, animateAllJobId: true },
    orderBy: { animateAllStartedAt: "desc" },
    take: limit,
  });

  for (const project of batchCandidates) {
    result.scanned++;
    const jobId = project.animateAllJobId;
    const userId = project.userId;
    if (!jobId || !userId) {
      result.skipped++;
      continue;
    }

    let job;
    try {
      job = await autopilot.getJob(jobId);
    } catch (err) {
      if (err instanceof AutopilotError && err.status === 404) {
        result.skipped++;
        continue;
      }
      result.errors.push({
        projectId: project.id,
        error: err instanceof Error ? err.message : String(err),
      });
      continue;
    }

    if (job.status !== "done") {
      result.skipped++;
      continue;
    }

    const scenes = batchScenes(job.result);
    if (scenes.length === 0) {
      result.skipped++;
      continue;
    }

    // Fetch every already-recorded key for this batch in one query so we only
    // backfill the scenes the client never finalized.
    const keys = scenes.map((s) => `animall_${jobId}_${s.sceneIdx}`);
    const existing = await prisma.vaterUsage.findMany({
      where: { idempotencyKey: { in: keys } },
      select: { idempotencyKey: true },
    });
    const billedKeys = new Set(existing.map((e) => e.idempotencyKey));

    let anyBackfilled = false;
    for (const scene of scenes) {
      const key = `animall_${jobId}_${scene.sceneIdx}`;
      if (billedKeys.has(key)) continue;
      const price = getAnimationPrice(scene.quality);
      const priceCents = price?.priceCents ?? 0;
      if (priceCents <= 0) {
        console.error(
          `[vater-reconcile] no price for quality "${scene.quality}" — batch ${jobId} scene ${scene.sceneIdx} NOT billed`,
        );
        continue;
      }
      anyBackfilled = true;
      await bill(
        {
          projectId: project.id,
          userId,
          jobId,
          action: "animation",
          idempotencyKey: key,
          costCents: priceCents,
          billed: false,
        },
        "animation",
        scene.quality,
      );
    }
    if (!anyBackfilled) result.skipped++;
  }

  return result;
}
