/**
 * POST /api/leads/dossier/process — Process queued dossier jobs
 *
 * Call this endpoint to kick off processing. It picks up the next queued job
 * and runs the full plugin pipeline. Can be called by:
 * - Manual curl
 * - Vercel cron (add to vercel.json)
 * - OpenClaw agent
 *
 * Query params:
 *   ?limit=1  — how many jobs to process (default 1, max 5)
 *   ?jobId=xxx — process a specific job by ID
 *
 * Auth: x-sync-secret header OR CRON_SECRET header
 */

import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { runDossierPipeline } from "@/lib/dossier/pipeline";
import { auth as getSession } from "@/auth";

const prisma = new PrismaClient();

async function checkAuth(req: NextRequest): Promise<boolean> {
  const syncSecret = req.headers.get("x-sync-secret");
  if (syncSecret && syncSecret === process.env.SYNC_SECRET) return true;
  const cronSecret = req.headers.get("authorization");
  if (cronSecret && cronSecret === `Bearer ${process.env.CRON_SECRET}`) return true;
  const session = await getSession();
  return Boolean(session?.user?.id);
}

export async function POST(req: NextRequest) {
  if (!(await checkAuth(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const limit = Math.min(parseInt(searchParams.get("limit") || "1"), 5);
  const specificJobId = searchParams.get("jobId");

  const results: { jobId: string; status: string; address: string; durationMs: number }[] = [];

  for (let i = 0; i < limit; i++) {
    // Pick next job
    let job;
    if (specificJobId && i === 0) {
      job = await prisma.dossierJob.findUnique({
        where: { id: specificJobId },
        include: { listing: { select: { address: true } } },
      });
      if (job && job.status !== "queued") {
        return NextResponse.json(
          { error: `Job ${specificJobId} is already ${job.status}` },
          { status: 400 }
        );
      }
    } else {
      job = await prisma.dossierJob.findFirst({
        where: { status: "queued" },
        orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
        include: { listing: { select: { address: true } } },
      });
    }

    if (!job) break;

    const startTime = Date.now();
    try {
      await runDossierPipeline(job.id);
      const updated = await prisma.dossierJob.findUnique({
        where: { id: job.id },
        select: { status: true },
      });
      results.push({
        jobId: job.id,
        status: updated?.status || "unknown",
        address: job.listing.address,
        durationMs: Date.now() - startTime,
      });
    } catch (err) {
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
        status: "failed",
        address: job.listing.address,
        durationMs: Date.now() - startTime,
      });
    }
  }

  return NextResponse.json({
    ok: true,
    processed: results.length,
    results,
  });
}
