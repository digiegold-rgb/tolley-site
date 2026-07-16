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

import { NextRequest, NextResponse, after } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateShopAdmin } from "@/lib/shop-auth";
import { normalizeQuery } from "@/lib/research/manus";
import { RESEARCH_ENGINE, advanceJob, runCloudPipeline } from "@/lib/research/jobs";
import type { ResearchAnswer } from "@/lib/research/prompt";

export const dynamic = "force-dynamic";
// The after() cloud pipeline (grounded Gemini ~50s + citation re-fetch
// ~40s) runs inside this function's lifetime.
export const maxDuration = 300;

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

  if (RESEARCH_ENGINE === "gemini") {
    // Run the ~10-40s cloud pipeline after the response is sent (after(),
    // never fire-and-forget — Vercel kills floating promises). The 2s
    // poller sees progress via the row updates the pipeline writes.
    after(() => runCloudPipeline(job.id));
    return NextResponse.json({ jobId: job.id, status: "running", engine: "gemini" });
  }

  // DGX engine: submission is one fast POST; run it inline so the first
  // poll already has a taskId. Concurrency cap keeps the DGX sane.
  const started = await advanceJob(job);
  return NextResponse.json({ jobId: started.id, status: started.status, engine: "manus" });
}
