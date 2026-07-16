/**
 * ResearchJob state machine — shared by the live poll route
 * (/api/research/[id]) and the reconciler cron (/api/cron/research-poll)
 * so a job advances identically whether a browser is watching or not.
 *
 * queued → submitted → running → (verifying) → completed | failed
 *
 * Two engines behind one row shape (RESEARCH_ENGINE env):
 *   "gemini" (default) — cloud: Gemini + Google Search grounding runs the
 *     whole pipeline in ~10-40s inside this Vercel function (kicked via
 *     next/server after()), then deterministic quote verification
 *     (lib/research/verify.ts) re-fetches every cited URL. No DGX involved.
 *   "manus" — the DGX OpenManus agent path with async task polling, kept
 *     as the free fallback when Gemini is unavailable.
 *
 * Verification soft-fails in both engines: a broken verify pass never
 * discards a finished answer, it just leaves claims marked unverified.
 */

import { prisma } from "@/lib/prisma";
import type { ResearchJob } from "@prisma/client";
import {
  DEFAULT_ETA_SECONDS,
  RESEARCH_MAX_STEPS,
  VERIFY_MAX_STEPS,
  applyVerdicts,
  extractResearchJson,
  extractVerifyJson,
  fetchManusTask,
  isManusReachable,
  parseSteps,
  submitManusTask,
} from "./manus";
import type { ResearchAnswer } from "./prompt";
import { buildResearchPrompt, buildVerifyPrompt } from "./prompt";
import { runGeminiExpansion, runGeminiResearch } from "./gemini";
import { applyWebVerdicts, verifyClaims } from "./verify";

/** Which engine runs new research jobs. */
export const RESEARCH_ENGINE: "gemini" | "manus" =
  process.env.RESEARCH_ENGINE === "manus" ? "manus" : "gemini";
/** Verification pass is the product's core promise — on unless explicitly
 *  disabled (RESEARCH_VERIFY=off) while debugging. */
const VERIFY_ENABLED = process.env.RESEARCH_VERIFY !== "off";
/** Give up on a DGX Manus task after this long. */
const STALE_TASK_MS = 60 * 60 * 1000;
/** A Gemini pipeline run is seconds, not minutes — if a running cloud job
 *  hasn't been touched in this long, its function died; fail it readably. */
const GEMINI_STALE_MS = 5 * 60 * 1000;
/** How many jobs may hit the DGX at once; the rest wait in `queued`. */
export const DGX_CONCURRENCY_CAP = 2;

/** Median duration of recent completed jobs → ETA for new ones. */
export async function estimateEtaSeconds(): Promise<number> {
  const recent = await prisma.researchJob.findMany({
    where: { status: "completed", startedAt: { not: null }, completedAt: { not: null } },
    orderBy: { completedAt: "desc" },
    take: 20,
    select: { startedAt: true, completedAt: true },
  });
  const durations = recent
    .map((r) => (r.completedAt!.getTime() - r.startedAt!.getTime()) / 1000)
    .filter((s) => s > 10 && s < 3600)
    .sort((a, b) => a - b);
  if (!durations.length) return DEFAULT_ETA_SECONDS;
  return Math.round(durations[Math.floor(durations.length / 2)]);
}

/**
 * Cloud pipeline (default engine): grounded Gemini call → deterministic
 * URL/quote verification → completed. Runs to completion inside the
 * calling function (POST via next/server after(), or the cron) in
 * ~10-40s, writing progress stages to the row so the 2s poller shows
 * live movement. On Gemini failure it falls back to the DGX Manus
 * engine when that's reachable, otherwise fails readably.
 */
export async function runCloudPipeline(jobId: string): Promise<ResearchJob> {
  await prisma.researchJob.update({
    where: { id: jobId },
    data: {
      status: "running",
      startedAt: new Date(),
      etaSeconds: 120,
      progress: 10,
      currentPhase: "searching",
      currentStep: "Round 1 — searching Google + reading sources (Gemini grounded)",
      stepDetails: [{ i: 0, tool: "gemini_grounded_search", label: "Grounded search + synthesis" }],
    },
  });

  const job = await prisma.researchJob.findUniqueOrThrow({ where: { id: jobId } });

  let answer: ResearchAnswer;
  let searchQueries: string[] = [];
  try {
    const grounded = await runGeminiResearch(job.query);
    answer = grounded.answer;
    searchQueries = grounded.searchQueries;
  } catch (err) {
    // Cloud engine down → try the DGX agent as fallback before failing.
    if (await isManusReachable()) {
      return startManusJob(job, err instanceof Error ? err.message : "gemini failed");
    }
    return prisma.researchJob.update({
      where: { id: jobId },
      data: {
        status: "failed",
        errorMessage: err instanceof Error ? err.message : "cloud research failed",
        completedAt: new Date(),
      },
    });
  }

  // Round 2 — self-expansion: hypothesize what round 1 missed and hunt
  // evidence for each candidate, incl. native-language searches. Merged
  // as an appendix with its own claims (verified in the same pass below).
  await prisma.researchJob.update({
    where: { id: jobId },
    data: {
      progress: 45,
      currentPhase: "reading",
      currentStep: "Round 2 — hunting what round 1 missed (incl. non-English sources)",
      stepDetails: [
        ...searchQueries.map((q, i) => ({ i, tool: "gemini_grounded_search", label: `Searched: ${q}` })),
        { i: searchQueries.length, tool: "gemini_grounded_search", label: "Expansion sweep: missed candidates + regional languages" },
      ],
    },
  });
  const expansion = await runGeminiExpansion(job.query, answer.answerMarkdown);
  if (expansion && expansion.answer.answerMarkdown.length > 50) {
    answer = {
      ...answer,
      answerMarkdown:
        answer.answerMarkdown +
        "\n\n---\n\n# Second-pass sweep\n\n" +
        expansion.answer.answerMarkdown,
      claims: [...answer.claims, ...expansion.answer.claims],
    };
    searchQueries = [...searchQueries, ...expansion.searchQueries];
  }

  if (!VERIFY_ENABLED || answer.claims.length === 0) {
    return completeJob(jobId, answer);
  }

  await prisma.researchJob.update({
    where: { id: jobId },
    data: {
      progress: 70,
      currentPhase: "verifying",
      currentStep: `Re-fetching ${answer.claims.reduce((n, c) => n + c.sources.length, 0)} cited pages to verify quotes`,
      result: toResultJson(answer),
      stepDetails: [
        ...searchQueries.map((q, i) => ({ i, tool: "gemini_grounded_search", label: `Searched: ${q}` })),
        { i: searchQueries.length, tool: "url_verifier", label: "Re-fetching cited pages, checking quotes" },
      ],
    },
  });

  try {
    const verdicts = await verifyClaims(answer.claims);
    return completeJob(jobId, applyWebVerdicts(answer, verdicts));
  } catch {
    return completeJob(jobId, answer, "verification crashed — claims shipped unverified");
  }
}

/** Submit the research task for a queued job on the DGX Manus engine. */
export async function startManusJob(job: ResearchJob, fallbackReason?: string): Promise<ResearchJob> {
  try {
    const taskId = await submitManusTask(buildResearchPrompt(job.query), {
      maxSteps: RESEARCH_MAX_STEPS,
      tags: ["research", job.id],
    });
    // Persist the taskId immediately — if we die after this line, the cron
    // can still reconcile the task (same crash-safety rule as synthesis.ts).
    return await prisma.researchJob.update({
      where: { id: job.id },
      data: {
        status: "submitted",
        manusTaskId: taskId,
        startedAt: new Date(),
        etaSeconds: await estimateEtaSeconds(),
        currentPhase: "searching",
        currentStep: fallbackReason
          ? "Cloud engine unavailable — DGX research agent took over"
          : "Handing off to the DGX research agent",
        progress: 2,
      },
    });
  } catch (err) {
    return await prisma.researchJob.update({
      where: { id: job.id },
      data: {
        status: "failed",
        errorMessage: err instanceof Error ? err.message : "submit failed",
        completedAt: new Date(),
      },
    });
  }
}

/**
 * Advance a job one tick: fetch engine state, update progress, and drive
 * the completed→verifying→completed transitions. Safe to call from both
 * the poll route and the cron; each call is idempotent for a given
 * upstream state.
 *
 * `opts.runCloud` — whether this caller may run the cloud pipeline to
 * completion inline (cron: yes; 30s-capped poll route: no, it only
 * observes and leaves orphaned queued jobs to the cron).
 */
export async function advanceJob(
  job: ResearchJob,
  opts?: { runCloud?: boolean }
): Promise<ResearchJob> {
  if (job.status === "completed" || job.status === "failed") return job;

  const isCloudJob = !job.manusTaskId;

  if (job.status === "queued") {
    if (RESEARCH_ENGINE === "gemini") {
      // Cloud jobs normally start via after() in the POST route; a queued
      // one here means that function died. Only the cron re-runs it.
      return opts?.runCloud ? runCloudPipeline(job.id) : job;
    }
    // DGX engine: respect the concurrency cap — the cron promotes queued
    // jobs as slots free up; the poll route just reports "waiting".
    const active = await prisma.researchJob.count({
      where: { status: { in: ["submitted", "running", "verifying"] } },
    });
    if (active >= DGX_CONCURRENCY_CAP) return job;
    return startManusJob(job);
  }

  // Cloud jobs in flight are driven by their own pipeline function — the
  // tick only watches for a died-function stall.
  if (isCloudJob) {
    if (Date.now() - job.updatedAt.getTime() > GEMINI_STALE_MS) {
      return prisma.researchJob.update({
        where: { id: job.id },
        data: {
          status: "failed",
          errorMessage: "cloud research run stalled (function died mid-run) — hit retry",
          completedAt: new Date(),
        },
      });
    }
    return job;
  }

  // Stale guard — the DGX lost the task or is down.
  if (job.startedAt && Date.now() - job.startedAt.getTime() > STALE_TASK_MS) {
    return prisma.researchJob.update({
      where: { id: job.id },
      data: {
        status: "failed",
        errorMessage: `research task stale after ${Math.round((Date.now() - job.startedAt.getTime()) / 60000)} min — DGX agent lost or overloaded`,
        completedAt: new Date(),
      },
    });
  }

  if (job.status === "verifying") return advanceVerify(job);

  // submitted | running — poll the research task
  if (!job.manusTaskId) {
    return prisma.researchJob.update({
      where: { id: job.id },
      data: { status: "failed", errorMessage: "job has no Manus taskId", completedAt: new Date() },
    });
  }
  const task = await fetchManusTask(job.manusTaskId);
  if (!task) return job; // transient fetch error — try again next tick

  if (task.status === "pending" || task.status === "running") {
    const parsed = parseSteps(task.steps);
    return prisma.researchJob.update({
      where: { id: job.id },
      data: {
        status: "running",
        progress: Math.max(job.progress, parsed.progress),
        currentPhase: parsed.phase,
        currentStep: parsed.currentStep,
        stepDetails: parsed.stepDetails,
      },
    });
  }

  if (task.status === "failed") {
    return prisma.researchJob.update({
      where: { id: job.id },
      data: {
        status: "failed",
        errorMessage: task.error ?? "DGX agent reported failure without a message",
        completedAt: new Date(),
      },
    });
  }

  // task.status === "completed" — parse the answer
  const answer = extractResearchJson(task.result);
  if (!answer) {
    return prisma.researchJob.update({
      where: { id: job.id },
      data: {
        status: "failed",
        errorMessage: "agent finished but did not honor the cited-answer output contract",
        completedAt: new Date(),
      },
    });
  }

  if (VERIFY_ENABLED && answer.claims.length > 0) {
    try {
      const verifyTaskId = await submitManusTask(buildVerifyPrompt(answer.claims), {
        maxSteps: VERIFY_MAX_STEPS,
        tags: ["verify", job.id],
      });
      return await prisma.researchJob.update({
        where: { id: job.id },
        data: {
          status: "verifying",
          verifyTaskId,
          result: toResultJson(answer),
          progress: 92,
          currentPhase: "verifying",
          currentStep: `Cross-verifying ${answer.claims.length} claims against their sources`,
        },
      });
    } catch {
      // Verification couldn't even start — ship the answer unverified.
      return completeJob(job.id, answer, "verify submit failed — claims shipped unverified");
    }
  }

  return completeJob(job.id, answer);
}

async function advanceVerify(job: ResearchJob): Promise<ResearchJob> {
  const draft = (job.result as unknown as ResearchAnswer | null) ?? null;
  if (!job.verifyTaskId || !draft) {
    return completeJob(job.id, draft ?? emptyAnswer(), "verification state lost — shipped unverified");
  }
  const task = await fetchManusTask(job.verifyTaskId);
  if (!task) return job;
  if (task.status === "pending" || task.status === "running") {
    const parsed = parseSteps(task.steps, { verifying: true });
    return prisma.researchJob.update({
      where: { id: job.id },
      data: {
        progress: Math.max(job.progress, 92 + Math.min(6, task.steps.length)),
        currentStep: parsed.currentStep,
      },
    });
  }
  if (task.status === "failed") {
    return completeJob(job.id, draft, "verification pass failed — claims shipped unverified");
  }
  const verdicts = extractVerifyJson(task.result);
  if (!verdicts) {
    return completeJob(job.id, draft, "verification output unparseable — claims shipped unverified");
  }
  return completeJob(job.id, applyVerdicts(draft, verdicts));
}

async function completeJob(
  jobId: string,
  answer: ResearchAnswer,
  verifyNote?: string
): Promise<ResearchJob> {
  const unverifiedNotes = [answer.unverifiedNotes, verifyNote].filter(Boolean).join(" · ") || undefined;
  return prisma.researchJob.update({
    where: { id: jobId },
    data: {
      status: "completed",
      progress: 100,
      currentPhase: "done",
      currentStep: null,
      confidence: answer.overallConfidence,
      result: toResultJson({ ...answer, unverifiedNotes }),
      completedAt: new Date(),
    },
  });
}

function toResultJson(answer: ResearchAnswer): object {
  return JSON.parse(JSON.stringify(answer)) as object;
}

function emptyAnswer(): ResearchAnswer {
  return { answerMarkdown: "", claims: [], overallConfidence: 0 };
}
