/**
 * GET /api/research/[id] — live poll for a research job.
 *
 * Each poll advances the job state machine one tick (fetch DGX task state,
 * update progress/phase, drive completed→verifying→completed), then returns
 * the slim job shape the progress UI renders. The cron reconciler runs the
 * same advanceJob() for jobs nobody is watching.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateShopAdmin } from "@/lib/shop-auth";
import { advanceJob } from "@/lib/research/jobs";
import type { ResearchAnswer } from "@/lib/research/prompt";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!(await validateShopAdmin())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const job = await prisma.researchJob.findUnique({ where: { id } });
  if (!job) return NextResponse.json({ error: "not found" }, { status: 404 });

  const advanced = await advanceJob(job);
  const result = advanced.result as unknown as ResearchAnswer | null;

  const elapsedSec = advanced.startedAt
    ? Math.round((Date.now() - advanced.startedAt.getTime()) / 1000)
    : 0;
  const etaRemaining =
    advanced.etaSeconds !== null && advanced.status !== "completed" && advanced.status !== "failed"
      ? Math.max(0, advanced.etaSeconds - elapsedSec)
      : null;

  return NextResponse.json({
    jobId: advanced.id,
    query: advanced.query,
    status: advanced.status,
    progress: advanced.progress,
    currentPhase: advanced.currentPhase,
    currentStep: advanced.currentStep,
    stepDetails: advanced.stepDetails,
    etaRemainingSeconds: etaRemaining,
    elapsedSeconds: elapsedSec,
    confidence: advanced.confidence,
    errorMessage: advanced.errorMessage,
    answer:
      advanced.status === "completed" && result
        ? {
            answerMarkdown: result.answerMarkdown,
            claims: result.claims,
            unverifiedNotes: result.unverifiedNotes,
          }
        : null,
    completedAt: advanced.completedAt,
  });
}
