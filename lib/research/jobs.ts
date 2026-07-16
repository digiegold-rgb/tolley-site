/**
 * ResearchJob state machine — shared by the live poll route
 * (/api/research/[id]) and the reconciler cron (/api/cron/research-poll)
 * so a job advances identically whether a browser is watching or not.
 *
 * queued → submitted → running → (verifying) → completed | failed
 *
 * Verification is a second bounded Manus task that re-fetches every cited
 * URL and checks it actually supports the claim. It soft-fails: a broken
 * verify pass never discards a finished answer, it just leaves claims
 * marked unverified.
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
  parseSteps,
  submitManusTask,
} from "./manus";
import type { ResearchAnswer } from "./prompt";
import { buildResearchPrompt, buildVerifyPrompt } from "./prompt";

/** Verification pass is the product's core promise — on unless explicitly
 *  disabled (RESEARCH_VERIFY=off) while debugging. */
const VERIFY_ENABLED = process.env.RESEARCH_VERIFY !== "off";
/** Give up on a Manus task after this long. */
const STALE_TASK_MS = 60 * 60 * 1000;
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

/** Submit the research task for a queued job. Returns the updated row. */
export async function startJob(job: ResearchJob): Promise<ResearchJob> {
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
        currentStep: "Handing off to the DGX research agent",
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
 * Advance a job one tick: fetch Manus state, update progress, and drive
 * the completed→verifying→completed transitions. Safe to call from both
 * the poll route and the cron; each call is idempotent for a given
 * upstream state.
 */
export async function advanceJob(job: ResearchJob): Promise<ResearchJob> {
  if (job.status === "completed" || job.status === "failed") return job;

  if (job.status === "queued") {
    // Respect the DGX concurrency cap — the cron promotes queued jobs as
    // slots free up; the poll route just reports "waiting for a slot".
    const active = await prisma.researchJob.count({
      where: { status: { in: ["submitted", "running", "verifying"] } },
    });
    if (active >= DGX_CONCURRENCY_CAP) return job;
    return startJob(job);
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
