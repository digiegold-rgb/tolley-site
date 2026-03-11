/**
 * POST /api/leads/dossier/batch — Batch dossier upload (up to 100 address rows)
 * GET  /api/leads/dossier/batch — List batches for current user
 *
 * Auth: session auth required
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth as getSession } from "@/auth";
import { runDossierPipeline } from "@/lib/dossier/pipeline";

// ── POST: Create batch dossier jobs from address rows ────────

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { name, source, rows } = body as {
    name?: string;
    source?: string;
    rows?: { address: string; city?: string; state?: string; zip?: string }[];
  };

  if (!rows?.length) {
    return NextResponse.json({ error: "rows array is required" }, { status: 400 });
  }

  if (rows.length > 100) {
    return NextResponse.json(
      { error: `Max 100 rows per batch (got ${rows.length})` },
      { status: 400 }
    );
  }

  // Create the batch record
  const batch = await prisma.dossierBatch.create({
    data: {
      name: name?.trim() || null,
      source: source?.trim() || "csv",
      totalRows: rows.length,
      status: "processing",
      userId: session.user.id,
    },
  });

  let skipped = 0;
  const jobIds: string[] = [];

  for (const row of rows) {
    const cleanAddress = row.address?.trim();
    if (!cleanAddress) {
      skipped++;
      continue;
    }

    const cleanCity = row.city?.trim() || "";
    const cleanState = row.state?.trim() || "MO";
    const cleanZip = row.zip?.trim() || "";

    // Find existing listing by address (case insensitive) + zip
    let listing = await prisma.listing.findFirst({
      where: {
        address: { equals: cleanAddress, mode: "insensitive" },
        ...(cleanZip ? { zip: cleanZip } : {}),
      },
    });

    if (!listing) {
      const batchMlsId = `BATCH-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      listing = await prisma.listing.create({
        data: {
          mlsId: batchMlsId,
          address: cleanAddress,
          city: cleanCity,
          state: cleanState,
          zip: cleanZip,
          status: "Manual Lookup",
          source: "manual",
        },
      });
    }

    // Skip if listing already has an active dossier job
    const existingJob = await prisma.dossierJob.findFirst({
      where: {
        listingId: listing.id,
        status: { in: ["queued", "running"] },
      },
    });

    if (existingJob) {
      skipped++;
      continue;
    }

    // Create dossier job linked to listing and batch
    const job = await prisma.dossierJob.create({
      data: {
        listingId: listing.id,
        batchId: batch.id,
        status: "queued",
        requestedBy: session.user.id,
      },
    });

    jobIds.push(job.id);
  }

  // Process batch jobs sequentially in background
  (async () => {
    const batchJobs = await prisma.dossierJob.findMany({
      where: { batchId: batch.id, status: "queued" },
      orderBy: { createdAt: "asc" },
    });
    for (const bj of batchJobs) {
      try {
        await runDossierPipeline(bj.id);
      } catch (err) {
        console.error(`[batch] Job ${bj.id} failed:`, err);
      }
      await prisma.dossierBatch.update({
        where: { id: batch.id },
        data: { processedRows: { increment: 1 } },
      });
    }
    await prisma.dossierBatch.update({
      where: { id: batch.id },
      data: { status: "complete" },
    });
  })().catch(console.error);

  return NextResponse.json({
    ok: true,
    batchId: batch.id,
    totalJobs: jobIds.length,
    skipped,
  });
}

// ── GET: List batches for current user ───────────────────────

export async function GET() {
  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const batches = await prisma.dossierBatch.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    include: {
      _count: {
        select: { jobs: true },
      },
      jobs: {
        select: { status: true },
      },
    },
  });

  const result = batches.map((b) => {
    const statusCounts: Record<string, number> = {};
    for (const job of b.jobs) {
      statusCounts[job.status] = (statusCounts[job.status] || 0) + 1;
    }
    const { jobs: _jobs, ...rest } = b;
    return {
      ...rest,
      jobStatusCounts: statusCounts,
    };
  });

  return NextResponse.json({ batches: result });
}
