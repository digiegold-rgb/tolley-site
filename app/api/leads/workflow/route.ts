/**
 * GET /api/leads/workflow — Returns workflow DAG status from latest (or specific) dossier job
 *
 * Query params:
 *   ?jobId=xxx — track a specific job instead of latest
 *
 * Auth: session OR x-sync-secret
 */

import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { auth as getSession } from "@/auth";

const prisma = new PrismaClient();

async function checkAuth(req: NextRequest): Promise<boolean> {
  const secret = req.headers.get("x-sync-secret");
  if (secret && secret === process.env.SYNC_SECRET) return true;
  const session = await getSession();
  return Boolean(session?.user?.id);
}

export async function GET(req: NextRequest) {
  if (!(await checkAuth(req)))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const jobId = req.nextUrl.searchParams.get("jobId");

  // Fetch a specific job or the most recent one
  const job = jobId
    ? await prisma.dossierJob.findUnique({
        where: { id: jobId },
        include: {
          listing: {
            select: { address: true, city: true, zip: true, mlsId: true },
          },
          result: {
            select: {
              motivationScore: true,
              motivationFlags: true,
              owners: true,
              entityType: true,
              pluginData: true,
            },
          },
        },
      })
    : await prisma.dossierJob.findFirst({
        orderBy: { createdAt: "desc" },
        include: {
          listing: {
            select: { address: true, city: true, zip: true, mlsId: true },
          },
          result: {
            select: {
              motivationScore: true,
              motivationFlags: true,
              owners: true,
              entityType: true,
              pluginData: true,
            },
          },
        },
      });

  if (!job) {
    return NextResponse.json({ latestJob: null });
  }

  // Extract per-scraper confidence from pluginData if available
  const pluginData = (job.result?.pluginData || {}) as Record<
    string,
    { confidence?: number; success?: boolean }
  >;
  const scraperConfidence: Record<string, number> = {};
  for (const [name, data] of Object.entries(pluginData)) {
    if (data.success && data.confidence) {
      scraperConfidence[name] = Math.round(data.confidence * 100);
    }
  }

  return NextResponse.json({
    latestJob: {
      id: job.id,
      status: job.status,
      progress: job.progress,
      currentStep: job.currentStep,
      stepsCompleted: job.stepsCompleted,
      stepsFailed: job.stepsFailed,
      createdAt: job.createdAt.toISOString(),
      completedAt: job.completedAt?.toISOString() ?? null,
      listing: job.listing,
      result: job.result
        ? {
            motivationScore: job.result.motivationScore,
            motivationFlags: job.result.motivationFlags,
            owners: job.result.owners,
            entityType: job.result.entityType,
          }
        : null,
      scraperConfidence,
    },
  });
}
