/**
 * GET /api/cron/dossier-process — Vercel cron safety net
 *
 * Runs every 2 minutes. Picks up any dossier jobs that are still queued
 * (because their originating request died before `after()` could complete,
 * or because the client pipeline crashed mid-flight) and runs the pipeline
 * for them.
 *
 * Also reaps jobs that have been "running" for too long (30+ minutes) by
 * marking them failed so the UI doesn't show a ghost job.
 *
 * Auth: Vercel cron sends `authorization: Bearer $CRON_SECRET` automatically.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { runDossierPipeline } from "@/lib/dossier/pipeline";
import {
  runSignalDossierBridge,
  type SignalBridgeResult,
} from "@/lib/leads/signal-dossier-bridge";

const MAX_JOBS_PER_RUN = 3;
const STALE_RUNNING_MS = 30 * 60 * 1000; // 30 minutes

function isAuthorized(req: NextRequest): boolean {
  const auth = req.headers.get("authorization");
  if (auth === `Bearer ${process.env.CRON_SECRET}`) return true;
  // Allow manual trigger with sync secret for local debugging
  const sync = req.headers.get("x-sync-secret");
  if (sync && sync === process.env.SYNC_SECRET) return true;
  return false;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 1. Reap stale running jobs — anything that's been "running" >30min is
  //    almost certainly a zombie from a killed function.
  const staleCutoff = new Date(Date.now() - STALE_RUNNING_MS);
  const reaped = await prisma.dossierJob.updateMany({
    where: {
      status: "running",
      startedAt: { lt: staleCutoff },
    },
    data: {
      status: "failed",
      errorMessage: "Job timed out — no progress for 30+ minutes",
      completedAt: new Date(),
    },
  });

  // 1b. Clean up stale "running" step details on terminal jobs. These
  //     happen when the pipeline finalizes the job (so the overall status
  //     is complete/partial/failed) but a post-finalization step — like
  //     synthesis-narrative — is still running when Vercel kills the
  //     function. Any step detail in `running` state for 10+ minutes on
  //     a terminal job gets marked as "failed" with a timeout message so
  //     the UI stops showing a ghost spinner.
  const stepStaleCutoff = new Date(Date.now() - 10 * 60 * 1000);
  const terminalJobs = await prisma.dossierJob.findMany({
    where: {
      status: { in: ["complete", "partial", "failed"] },
      completedAt: { lt: stepStaleCutoff },
      stepDetails: { not: {} },
    },
    select: { id: true, stepDetails: true },
    take: 20,
  });
  let stepsCleaned = 0;
  for (const job of terminalJobs) {
    const details = job.stepDetails as Record<string, Record<string, unknown>> | null;
    if (!details) continue;
    let changed = false;
    for (const [name, detail] of Object.entries(details)) {
      if (detail?.status === "running") {
        details[name] = {
          ...detail,
          status: "failed",
          error:
            (detail.error as string | undefined) ??
            "step was still running when the job's function was killed",
          finishedAt: new Date().toISOString(),
        };
        changed = true;
        stepsCleaned++;
      }
    }
    if (changed) {
      await prisma.dossierJob.update({
        where: { id: job.id },
        data: { stepDetails: details as unknown as object },
      });
    }
  }

  // 2. Pick up queued jobs, oldest first. Respect priority.
  const queued = await prisma.dossierJob.findMany({
    where: { status: "queued" },
    orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
    take: MAX_JOBS_PER_RUN,
    select: {
      id: true,
      listing: { select: { address: true } },
    },
  });

  const results: {
    jobId: string;
    address: string;
    status: string;
    durationMs: number;
  }[] = [];

  for (const job of queued) {
    const start = Date.now();
    try {
      await runDossierPipeline(job.id);
      const updated = await prisma.dossierJob.findUnique({
        where: { id: job.id },
        select: { status: true },
      });
      results.push({
        jobId: job.id,
        address: job.listing.address,
        status: updated?.status ?? "unknown",
        durationMs: Date.now() - start,
      });
    } catch (err) {
      console.error(`[dossier-process] Job ${job.id} crashed:`, err);
      await prisma.dossierJob.update({
        where: { id: job.id },
        data: {
          status: "failed",
          errorMessage: err instanceof Error ? err.message : "Pipeline crash",
          completedAt: new Date(),
        },
      });
      results.push({
        jobId: job.id,
        address: job.listing.address,
        status: "failed",
        durationMs: Date.now() - start,
      });
    }
  }

  // 3. Guaranteed producer: when the queue is drained, top it up from the
  //    fresh probate/distress signal stream (capped ~3/day). This is what
  //    keeps the Monday digest non-empty — the Parcel-based auto-scan producer
  //    has never yielded a row. Never let a bridge failure break the reaper.
  let bridge: SignalBridgeResult | { error: string } | null = null;
  if (queued.length === 0) {
    try {
      bridge = await runSignalDossierBridge();
    } catch (err) {
      console.error("[dossier-process] signal bridge failed:", err);
      bridge = { error: err instanceof Error ? err.message : String(err) };
    }
  }

  return NextResponse.json({
    ok: true,
    reapedStale: reaped.count,
    stepsCleaned,
    processed: results.length,
    results,
    bridge,
  });
}
