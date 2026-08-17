import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateShopAdmin } from "@/lib/shop-auth";

export const runtime = "nodejs";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ batchId: string }> }
) {
  if (!(await validateShopAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { batchId } = await params;

  const [jobs, hb] = await Promise.all([
    prisma.bulkIngestJob.findMany({
    where: { batchId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      status: true,
      photoUrls: true,
      productId: true,
      visionResult: true,
      amazonAsin: true,
      amazonPriceCents: true,
      confidence: true,
      attempts: true,
      lastStage: true,
      lastError: true,
      startedAt: true,
      completedAt: true,
      createdAt: true,
    },
    }),
    prisma.workerHeartbeat.findUnique({ where: { name: "bulk-ingest-worker" } }),
  ]);

  if (jobs.length === 0) {
    return NextResponse.json({ error: "Batch not found" }, { status: 404 });
  }

  // Project visionResult to title only for compactness in the polling payload
  const compact = jobs.map((j) => {
    const v = j.visionResult as { title?: string; category?: string } | null;
    return {
      id: j.id,
      status: j.status,
      photoCount: j.photoUrls.length,
      thumbnail: j.photoUrls[0] ?? null,
      productId: j.productId,
      title: v?.title ?? null,
      category: v?.category ?? null,
      confidence: j.confidence,
      amazonAsin: j.amazonAsin,
      amazonPriceCents: j.amazonPriceCents,
      lastStage: j.lastStage,
      lastError: j.lastError,
      attempts: j.attempts,
      startedAt: j.startedAt,
      completedAt: j.completedAt,
      createdAt: j.createdAt,
    };
  });

  // Worker liveness — the drainer stamps WorkerHeartbeat every 15s tick.
  // >90s stale = down (covers a restart window without false alarms).
  const WORKER_STALE_MS = 90_000;
  const lastSeen = hb?.lastSeen ?? null;
  const ageMs = lastSeen ? Date.now() - lastSeen.getTime() : null;
  const worker = {
    name: "bulk-ingest-worker",
    alive: ageMs != null && ageMs < WORKER_STALE_MS,
    lastSeen,
    ageSec: ageMs != null ? Math.round(ageMs / 1000) : null,
  };

  return NextResponse.json({ batchId, jobs: compact, worker });
}
