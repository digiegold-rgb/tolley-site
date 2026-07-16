/**
 * /api/research — Deep Research Search.
 *
 * GET ?q=   Lane 1: instant lookup. Exact normalized-query match against
 *           completed ResearchJobs, plus a small list of recent answers as
 *           type-ahead suggestions. Slim /tv-style payload.
 * POST      Lane 2: enqueue a deep research job (dedupes onto an identical
 *           in-flight job) and kick the DGX submission inline so the first
 *           poll already has a taskId.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateShopAdmin } from "@/lib/shop-auth";
import { normalizeQuery } from "@/lib/research/manus";
import { advanceJob } from "@/lib/research/jobs";
import type { ResearchAnswer } from "@/lib/research/prompt";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function slimAnswer(job: {
  id: string;
  query: string;
  confidence: number | null;
  result: unknown;
  completedAt: Date | null;
  cacheHits: number;
}) {
  const result = job.result as unknown as ResearchAnswer | null;
  return {
    jobId: job.id,
    query: job.query,
    confidence: job.confidence,
    answerMarkdown: result?.answerMarkdown ?? "",
    claims: result?.claims ?? [],
    unverifiedNotes: result?.unverifiedNotes,
    completedAt: job.completedAt,
    cacheHits: job.cacheHits,
  };
}

export async function GET(req: NextRequest) {
  if (!(await validateShopAdmin())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const q = (req.nextUrl.searchParams.get("q") || "").trim();
  if (!q) return NextResponse.json({ hit: null, suggestions: [] });

  const normalized = normalizeQuery(q);

  const exact = await prisma.researchJob.findFirst({
    where: { queryNormalized: normalized, status: "completed" },
    orderBy: { completedAt: "desc" },
  });
  if (exact) {
    await prisma.researchJob.update({
      where: { id: exact.id },
      data: { cacheHits: { increment: 1 } },
    });
    return NextResponse.json({
      hit: { ...slimAnswer(exact), source: "exact", similarity: 1 },
      suggestions: [],
    });
  }

  // Type-ahead: recent completed answers whose query contains the input.
  const suggestions = await prisma.researchJob.findMany({
    where: { status: "completed", queryNormalized: { contains: normalized } },
    orderBy: { completedAt: "desc" },
    take: 5,
    select: { id: true, query: true, confidence: true, completedAt: true },
  });

  return NextResponse.json({ hit: null, suggestions });
}

export async function POST(req: NextRequest) {
  if (!(await validateShopAdmin())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = (await req.json().catch(() => ({}))) as { query?: string };
  const query = (body.query || "").trim();
  if (query.length < 8) {
    return NextResponse.json({ error: "Ask a real question (8+ characters)" }, { status: 400 });
  }
  if (query.length > 2000) {
    return NextResponse.json({ error: "Question too long (2000 char max)" }, { status: 400 });
  }

  const normalized = normalizeQuery(query);

  // Dedupe: identical question already in flight → attach to it.
  const inFlight = await prisma.researchJob.findFirst({
    where: {
      queryNormalized: normalized,
      status: { in: ["queued", "submitted", "running", "verifying"] },
    },
    orderBy: { createdAt: "desc" },
  });
  if (inFlight) {
    return NextResponse.json({ jobId: inFlight.id, deduped: true });
  }

  const job = await prisma.researchJob.create({
    data: { query, queryNormalized: normalized, requestedBy: "shop-admin" },
  });

  // Kick the DGX submission inline (fast — one POST). advanceJob respects
  // the concurrency cap; if the DGX is busy the job stays queued and the
  // cron promotes it when a slot frees.
  const started = await advanceJob(job);

  return NextResponse.json({ jobId: started.id, status: started.status });
}
