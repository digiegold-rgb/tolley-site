/**
 * GET /api/cron/dossier-synthesis-poll — async narrative reconciliation
 *
 * The inline synthesis call in `lib/dossier/pipeline.ts` is capped at 90
 * seconds so the Vercel function doesn't blow past its 300s max duration.
 * Real synthesis on Qwen3.5-35B takes 6-9 minutes, so the inline call
 * almost always times out. When it does, the pipeline stashes the Manus
 * taskId in `DossierResult.narrativeMeta.status = "pending"`.
 *
 * This cron (runs every 5 min) picks up those pending rows, asks Manus
 * if the task has completed, and if so, extracts the narrative and writes
 * it back to the DossierResult.
 *
 * Lifecycle of `narrativeMeta.status`:
 *   (null)      — synthesis was never attempted (pre-integration rows)
 *   "pending"   — submitted to Manus, inline call timed out, awaiting poll
 *   "completed" — narrative landed (either inline or async)
 *   "failed"    — Manus reported failure, or task got too old (>1hr)
 *   "skipped"   — Manus was unreachable at submission time
 *
 * Auth: Vercel cron sends `Authorization: Bearer $CRON_SECRET`.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { extractNarrativeMarkdown } from "@/lib/dossier/synthesis";

const OPENMANUS_URL = process.env.OPENMANUS_URL || "";
const SYNC_SECRET = process.env.SYNC_SECRET || "";

/** How many pending rows to reconcile per cron run. */
const MAX_PER_RUN = 10;
/** How long we'll wait for a Manus task before giving up on it entirely. */
const STALE_TASK_MS = 60 * 60 * 1000; // 1 hour

interface PendingMeta {
  status: "pending";
  taskId: string;
  submittedAt: string;
  inlineDurationMs?: number;
}

interface ManusTask {
  id: string;
  status: "pending" | "running" | "completed" | "failed";
  result: string | null;
  error: string | null;
  steps: string[];
}

function isAuthorized(req: NextRequest): boolean {
  const auth = req.headers.get("authorization");
  if (auth === `Bearer ${process.env.CRON_SECRET}`) return true;
  const sync = req.headers.get("x-sync-secret");
  if (sync && sync === process.env.SYNC_SECRET) return true;
  return false;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!OPENMANUS_URL) {
    return NextResponse.json({
      ok: true,
      skipped: "OPENMANUS_URL not configured",
      processed: 0,
    });
  }

  // Find DossierResults that have a pending synthesis task. Prisma doesn't
  // expose a clean JSON path filter across providers, so we pull a small
  // window and filter client-side. This is cheap because the set is small.
  const candidates = await prisma.dossierResult.findMany({
    where: {
      narrativeReport: null,
      narrativeMeta: { not: {} as object },
    },
    select: {
      jobId: true,
      narrativeMeta: true,
    },
    orderBy: { updatedAt: "desc" },
    take: 50,
  });

  const pending = candidates
    .map((r) => ({
      jobId: r.jobId,
      meta: r.narrativeMeta as unknown as PendingMeta | null,
    }))
    .filter(
      (c): c is { jobId: string; meta: PendingMeta } =>
        !!c.meta && c.meta.status === "pending" && typeof c.meta.taskId === "string"
    )
    .slice(0, MAX_PER_RUN);

  const results: Array<{
    jobId: string;
    taskId: string;
    outcome: "completed" | "still_running" | "failed" | "stale" | "fetch_error";
    detail?: string;
  }> = [];

  for (const { jobId, meta } of pending) {
    // Age check — if this has been pending for over an hour, Manus is lost.
    const ageMs = Date.now() - new Date(meta.submittedAt).getTime();
    if (ageMs > STALE_TASK_MS) {
      await prisma.dossierResult.update({
        where: { jobId },
        data: {
          narrativeMeta: {
            status: "failed",
            taskId: meta.taskId,
            submittedAt: meta.submittedAt,
            error: `task stale after ${Math.round(ageMs / 60000)}min, abandoning`,
          },
        },
      });
      await markSynthesisFailed(jobId, `stale after ${Math.round(ageMs / 60000)}min`);
      results.push({ jobId, taskId: meta.taskId, outcome: "stale" });
      continue;
    }

    // Fetch task state from Manus
    let task: ManusTask | null = null;
    try {
      const res = await fetch(`${OPENMANUS_URL}/api/task/${meta.taskId}`, {
        headers: { "x-auth-token": SYNC_SECRET },
        signal: AbortSignal.timeout(10_000),
      });
      if (res.ok) {
        task = (await res.json()) as ManusTask;
      } else {
        results.push({
          jobId,
          taskId: meta.taskId,
          outcome: "fetch_error",
          detail: `HTTP ${res.status}`,
        });
        continue;
      }
    } catch (err) {
      results.push({
        jobId,
        taskId: meta.taskId,
        outcome: "fetch_error",
        detail: err instanceof Error ? err.message : "unknown",
      });
      continue;
    }

    if (task.status === "running" || task.status === "pending") {
      results.push({ jobId, taskId: meta.taskId, outcome: "still_running" });
      continue;
    }

    if (task.status === "failed") {
      await prisma.dossierResult.update({
        where: { jobId },
        data: {
          narrativeMeta: {
            status: "failed",
            taskId: meta.taskId,
            submittedAt: meta.submittedAt,
            error: task.error ?? "Manus reported failure",
            stepsUsed: task.steps.length,
          },
        },
      });
      await markSynthesisFailed(jobId, task.error ?? "Manus reported failure");
      results.push({
        jobId,
        taskId: meta.taskId,
        outcome: "failed",
        detail: task.error ?? undefined,
      });
      continue;
    }

    // task.status === "completed"
    const narrative = extractNarrativeMarkdown(task.result);
    if (!narrative) {
      await prisma.dossierResult.update({
        where: { jobId },
        data: {
          narrativeMeta: {
            status: "failed",
            taskId: meta.taskId,
            submittedAt: meta.submittedAt,
            error: "task completed but no narrative marker found in result",
            stepsUsed: task.steps.length,
          },
        },
      });
      await markSynthesisFailed(jobId, "no narrative marker in completed task");
      results.push({
        jobId,
        taskId: meta.taskId,
        outcome: "failed",
        detail: "no narrative marker",
      });
      continue;
    }

    // Success — write the narrative and upgrade stepDetails
    await prisma.dossierResult.update({
      where: { jobId },
      data: {
        narrativeReport: narrative,
        narrativeMeta: {
          status: "completed",
          taskId: meta.taskId,
          stepsUsed: task.steps.length,
          submittedAt: meta.submittedAt,
          reconciledAt: new Date().toISOString(),
          reconciliationAgeMs: ageMs,
          source: "async-poll",
        },
      },
    });
    await markSynthesisSuccess(jobId, task.steps.length, ageMs);
    results.push({ jobId, taskId: meta.taskId, outcome: "completed" });
  }

  return NextResponse.json({
    ok: true,
    inspected: pending.length,
    processed: results.length,
    results,
  });
}

/**
 * Flip stepDetails["synthesis-narrative"] to success on a job whose inline
 * run timed out. We're intentionally bypassing PipelineTracker because the
 * job is long since finalized — this is a direct JSON merge.
 */
async function markSynthesisSuccess(
  jobId: string,
  stepsUsed: number,
  reconciliationAgeMs: number
): Promise<void> {
  const current = await prisma.dossierJob.findUnique({
    where: { id: jobId },
    select: { stepDetails: true, stepsCompleted: true, stepsFailed: true },
  });
  if (!current) return;

  const details =
    (current.stepDetails as Record<string, Record<string, unknown>> | null) ?? {};
  const prior = details["synthesis-narrative"] ?? { source: "worker" };
  details["synthesis-narrative"] = {
    ...prior,
    status: "success",
    finishedAt: new Date().toISOString(),
    durationMs: reconciliationAgeMs,
    confidence: 0.85,
    reconciledAsync: true,
    stepsUsed,
  };

  // Move "synthesis-narrative" out of stepsFailed (where the inline timeout
  // put it) and into stepsCompleted so the dossier summary is accurate.
  const stepsFailed = (current.stepsFailed || []).filter((n) => n !== "synthesis-narrative");
  const stepsCompleted = current.stepsCompleted || [];
  if (!stepsCompleted.includes("synthesis-narrative")) {
    stepsCompleted.push("synthesis-narrative");
  }

  await prisma.dossierJob.update({
    where: { id: jobId },
    data: {
      stepDetails: details as unknown as object,
      stepsCompleted,
      stepsFailed,
    },
  });
}

async function markSynthesisFailed(jobId: string, error: string): Promise<void> {
  const current = await prisma.dossierJob.findUnique({
    where: { id: jobId },
    select: { stepDetails: true },
  });
  if (!current) return;

  const details =
    (current.stepDetails as Record<string, Record<string, unknown>> | null) ?? {};
  const prior = details["synthesis-narrative"] ?? { source: "worker" };
  details["synthesis-narrative"] = {
    ...prior,
    status: "failed",
    finishedAt: new Date().toISOString(),
    error: error.slice(0, 500),
  };

  await prisma.dossierJob.update({
    where: { id: jobId },
    data: { stepDetails: details as unknown as object },
  });
}
