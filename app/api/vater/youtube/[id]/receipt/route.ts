/**
 * GET /api/vater/youtube/[id]/receipt
 *
 * The itemised receipt for one finished video — what it cost us, what it cost
 * the customer, and how long it took. Shown to EVERY tier in the final-video
 * player, not just the owner's own projects: a render that quietly costs
 * money and shows one opaque total is exactly the thing customers do not
 * trust. See memory vater-billing-ops-fee ("he doesn't have to wonder where
 * all the money is spent").
 *
 * {
 *   computeUsd, byStage[{key,label,usd}], minutes, opsRate, opsUsd, totalUsd,
 *   estimateUsd, cappedAt?, debitedCents|null, debitedAt|null,
 *   wallClockSec|null, unmetered
 * }
 *
 * `debitedCents` is null when nothing was charged — an unmetered account, a
 * legacy project, or the credit migration not yet applied. `totalUsd` is
 * always the real cost of the video; when the repair cap fired they differ,
 * on purpose, and the UI says which is which.
 */

import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { checkProjectAccess } from "@/lib/vater/project-access";
import { stageLabel } from "@/lib/vater/billing/summary";
import { getOpsRate } from "@/lib/vater/billing/ops-fee";
import {
  buildDebitLine,
  getProjectDebit,
  type VideoBillingLineJson,
} from "@/lib/vater/billing/ledger";
import { hasUnmeteredStudioAccess } from "@/lib/vater/billing/check-budget";

export const runtime = "nodejs";

const r2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Wall-clock seconds for the render, from what the poll route already writes:
 *   stepDetails.startedAt   — stamped on the FIRST poll of the job
 *   stepDetails.phaseTimings — { [phase]: { startedAt, endedAt? } } ISO stamps
 *
 * Span, not sum: the phases are sequential, so earliest start → latest end is
 * the elapsed time. Summing the entries would double-count nothing but would
 * silently drop the gaps between phases, which are real minutes the customer
 * waited.
 */
function readWallClockSec(
  stepDetails: unknown,
  completedAt: Date | null,
): number | null {
  const sd = (stepDetails ?? {}) as {
    startedAt?: string;
    phaseTimings?: Record<string, { startedAt?: string; endedAt?: string }>;
  };

  const ms = (v: string | undefined): number | null => {
    if (!v) return null;
    const n = new Date(v).getTime();
    return Number.isFinite(n) ? n : null;
  };

  const starts: number[] = [];
  const ends: number[] = [];
  const jobStart = ms(sd.startedAt);
  if (jobStart !== null) starts.push(jobStart);
  for (const v of Object.values(sd.phaseTimings ?? {})) {
    const s = ms(v?.startedAt);
    const e = ms(v?.endedAt);
    if (s !== null) starts.push(s);
    if (e !== null) ends.push(e);
  }
  if (completedAt) ends.push(completedAt.getTime());

  if (starts.length === 0 || ends.length === 0) return null;
  const elapsed = Math.max(...ends) - Math.min(...starts);
  return elapsed > 0 ? Math.round(elapsed / 1000) : null;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const access = await checkProjectAccess(id, session.user.id, session.user.email);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const project = await prisma.youTubeProject.findUnique({
    where: { id },
    select: {
      id: true,
      userId: true,
      status: true,
      finalVideoUrl: true,
      audioDuration: true,
      targetDuration: true,
      costJson: true,
      publishTitle: true,
      sourceTitle: true,
      completedAt: true,
      stepDetails: true,
    },
  });
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const { line } = buildDebitLine(project);

  const byStageRaw =
    ((project.costJson as { byStage?: Record<string, { usd?: number }> } | null)
      ?.byStage) ?? {};
  const byStage = Object.entries(byStageRaw)
    .map(([key, v]) => ({ key, label: stageLabel(key), usd: r2(Number(v?.usd ?? 0)) }))
    .filter((row) => row.usd > 0)
    .sort((a, b) => b.usd - a.usd);

  const debit = project.userId ? await getProjectDebit(id) : null;
  const unmetered = project.userId
    ? await hasUnmeteredStudioAccess(project.userId)
    : false;

  const debitLine = (debit?.lineJson ?? null) as VideoBillingLineJson | null;

  return NextResponse.json({
    projectId: project.id,
    title: project.publishTitle ?? project.sourceTitle ?? null,
    computeUsd: line.computeUsd,
    byStage,
    minutes: line.minutes,
    durationSeconds: Math.round(Number(project.audioDuration ?? 0)),
    opsRate: getOpsRate(),
    opsUsd: line.opsUsd,
    totalUsd: line.totalUsd,
    estimateUsd: line.estimateUsd,
    // Present only when the repair cap fired: what the customer was charged
    // instead of totalUsd, with Tolley eating the difference.
    cappedAt: line.cappedAt ?? debitLine?.cappedAt ?? null,
    debitedCents: debit ? -debit.deltaCents : null,
    debitedAt: debit?.createdAt ?? null,
    unmetered,
    wallClockSec: readWallClockSec(project.stepDetails, project.completedAt),
  });
}
