/**
 * GET /api/cron/dossier-cleanup — Auto-fail stale dossier jobs
 *
 * Finds jobs stuck in "running" for > 30 minutes and marks them failed.
 * Also resets "queued" jobs older than 1 hour (never picked up).
 *
 * Runs every 15 minutes via Vercel cron.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const STALE_RUNNING_MS = 30 * 60 * 1000; // 30 min
const STALE_QUEUED_MS = 60 * 60 * 1000;  // 1 hour

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const syncHeader = req.headers.get("x-sync-secret");

  const cronOk =
    process.env.CRON_SECRET &&
    authHeader === `Bearer ${process.env.CRON_SECRET}`;
  const syncOk =
    process.env.SYNC_SECRET && syncHeader === process.env.SYNC_SECRET;

  if (!cronOk && !syncOk) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();

  // Fail jobs stuck in "running" for > 30 min
  const staleRunning = await prisma.dossierJob.updateMany({
    where: {
      status: "running",
      startedAt: { lt: new Date(now.getTime() - STALE_RUNNING_MS) },
    },
    data: {
      status: "failed",
      errorMessage: "Auto-failed: stale job exceeded 30-minute timeout",
      completedAt: now,
      currentStep: null,
    },
  });

  // Fail jobs stuck in "queued" for > 1 hour (never picked up)
  const staleQueued = await prisma.dossierJob.updateMany({
    where: {
      status: "queued",
      createdAt: { lt: new Date(now.getTime() - STALE_QUEUED_MS) },
    },
    data: {
      status: "failed",
      errorMessage: "Auto-failed: queued job was never picked up within 1 hour",
      completedAt: now,
    },
  });

  const total = staleRunning.count + staleQueued.count;
  if (total > 0) {
    console.log(`[dossier-cleanup] Cleaned up ${staleRunning.count} stale running + ${staleQueued.count} stale queued jobs`);
  }

  return NextResponse.json({
    ok: true,
    cleaned: {
      staleRunning: staleRunning.count,
      staleQueued: staleQueued.count,
    },
  });
}
