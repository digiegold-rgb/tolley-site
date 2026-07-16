/**
 * GET /api/cron/research-poll — Deep Research reconciler (every 2 min).
 *
 * Advances every non-terminal ResearchJob one tick via the same
 * advanceJob() state machine the live poll route uses. This is what
 * finishes jobs whose browser tab closed mid-run, promotes queued jobs
 * when a DGX slot frees up, and fails stale tasks (>1h) with a readable
 * error. Same auth shape as dossier-synthesis-poll.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { advanceJob } from "@/lib/research/jobs";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const MAX_PER_RUN = 10;

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

  // In-flight jobs first (they may free DGX slots), then queued ones so
  // freshly-freed slots get filled in the same run.
  const jobs = await prisma.researchJob.findMany({
    where: { status: { in: ["submitted", "running", "verifying", "queued"] } },
    orderBy: [{ status: "desc" }, { createdAt: "asc" }],
    take: MAX_PER_RUN,
  });

  const results: Array<{ jobId: string; from: string; to: string }> = [];
  for (const job of jobs) {
    try {
      const advanced = await advanceJob(job, { runCloud: true });
      results.push({ jobId: job.id, from: job.status, to: advanced.status });
    } catch (err) {
      console.error(`[research-poll] advance failed for ${job.id}:`, err);
      results.push({ jobId: job.id, from: job.status, to: "error" });
    }
  }

  return NextResponse.json({ ok: true, processed: results.length, results });
}
