/**
 * GET    /api/leads/dossier/[id] — Get dossier job status + full result
 * PATCH  /api/leads/dossier/[id] — Update dossier result fields + listing rawData
 * POST   /api/leads/dossier/[id] — Re-run dossier research (creates new job)
 * DELETE /api/leads/dossier/[id] — Cancel a queued job
 *
 * Auth: x-sync-secret header OR NextAuth session
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { runDossierPipeline } from "@/lib/dossier/pipeline";

async function checkAuth(req: NextRequest): Promise<boolean> {
  const secret = req.headers.get("x-sync-secret");
  if (secret && secret === process.env.SYNC_SECRET) return true;
  const { auth: getSession } = await import("@/auth");
  const session = await getSession();
  return Boolean(session?.user?.id);
}

// ── GET — job status + result ───────────────────────────────

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await checkAuth(req)))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const job = await prisma.dossierJob.findUnique({
    where: { id },
    include: {
      listing: {
        include: {
          enrichment: true,
          leads: { take: 1, orderBy: { score: "desc" } },
        },
      },
      result: true,
    },
  });

  if (!job) {
    return NextResponse.json({ error: "Dossier job not found" }, { status: 404 });
  }

  return NextResponse.json({ job });
}

// ── PATCH — update dossier result fields ────────────────────

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await checkAuth(req)))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const job = await prisma.dossierJob.findUnique({
    where: { id },
    include: { result: true, listing: true },
  });

  if (!job) {
    return NextResponse.json({ error: "Dossier job not found" }, { status: 404 });
  }

  if (!job.result) {
    return NextResponse.json(
      { error: "No result to update — job has not completed yet" },
      { status: 400 }
    );
  }

  const body = await req.json();
  const { owners, ownerName, ownerPhone, ownerEmail, researchSummary } = body as {
    owners?: Array<{
      name: string;
      role?: string;
      phone?: string;
      email?: string;
      age?: number;
      address?: string;
    }>;
    ownerName?: string;
    ownerPhone?: string;
    ownerEmail?: string;
    researchSummary?: string;
  };

  // Build result update payload
  const resultUpdate: Record<string, unknown> = {};

  if (owners !== undefined) resultUpdate.owners = owners;
  if (researchSummary !== undefined) resultUpdate.researchSummary = researchSummary;

  // If ownerName/phone/email provided but no owners array, merge into existing owners
  if (!owners && (ownerName || ownerPhone || ownerEmail)) {
    const existingOwners = (job.result.owners as Array<Record<string, unknown>>) ?? [];
    if (existingOwners.length > 0) {
      // Update the first owner with provided fields
      const first = { ...existingOwners[0] };
      if (ownerName) first.name = ownerName;
      if (ownerPhone) first.phone = ownerPhone;
      if (ownerEmail) first.email = ownerEmail;
      resultUpdate.owners = [first, ...existingOwners.slice(1)];
    } else {
      // Create a new owner entry
      resultUpdate.owners = [
        {
          name: ownerName ?? "Unknown",
          ...(ownerPhone && { phone: ownerPhone }),
          ...(ownerEmail && { email: ownerEmail }),
        },
      ];
    }
  }

  // Apply result update
  if (Object.keys(resultUpdate).length > 0) {
    await prisma.dossierResult.update({
      where: { id: job.result.id },
      data: resultUpdate,
    });
  }

  // Update listing rawData.ownerName so re-runs pick it up
  const nameToStore = ownerName ?? (owners?.[0]?.name || null);
  if (nameToStore) {
    const existingRaw = (job.listing.rawData as Record<string, unknown>) ?? {};
    await prisma.listing.update({
      where: { id: job.listingId },
      data: {
        rawData: { ...existingRaw, ownerName: nameToStore },
      },
    });
  }

  // Return updated result
  const updated = await prisma.dossierResult.findUnique({
    where: { id: job.result.id },
  });

  return NextResponse.json({ ok: true, result: updated });
}

// ── POST — re-run dossier research ──────────────────────────

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await checkAuth(req)))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const existingJob = await prisma.dossierJob.findUnique({
    where: { id },
    include: { result: true, listing: true },
  });

  if (!existingJob) {
    return NextResponse.json({ error: "Dossier job not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const { ownerName, ownerPhone, ownerEmail } = body as {
    ownerName?: string;
    ownerPhone?: string;
    ownerEmail?: string;
  };

  // Store ownerName / ownerPhone / ownerEmail into listing rawData for the re-run
  if (ownerName || ownerPhone || ownerEmail) {
    const existingRaw = (existingJob.listing.rawData as Record<string, unknown>) ?? {};
    await prisma.listing.update({
      where: { id: existingJob.listingId },
      data: {
        rawData: {
          ...existingRaw,
          ...(ownerName && { ownerName }),
          ...(ownerPhone && { ownerPhone }),
          ...(ownerEmail && { ownerEmail }),
        },
      },
    });
  }

  // Create new DossierJob for the same listing
  const newJob = await prisma.dossierJob.create({
    data: {
      listingId: existingJob.listingId,
      leadId: existingJob.leadId,
      requestedBy: existingJob.requestedBy ?? "admin",
      priority: existingJob.priority,
      status: "queued",
    },
  });

  // Fire-and-forget pipeline run
  runDossierPipeline(newJob.id).catch((err) => {
    console.error(`[dossier] re-run pipeline error for job ${newJob.id}:`, err);
  });

  return NextResponse.json({
    ok: true,
    jobId: newJob.id,
    previousJobId: id,
    previousStatus: existingJob.status,
  });
}

// ── DELETE — cancel a queued job ────────────────────────────

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await checkAuth(req)))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const job = await prisma.dossierJob.findUnique({ where: { id } });
  if (!job) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (job.status === "queued") {
    await prisma.dossierJob.update({
      where: { id },
      data: { status: "cancelled" },
    });
    return NextResponse.json({ ok: true, status: "cancelled" });
  }

  return NextResponse.json(
    { error: `Cannot cancel job in status: ${job.status}` },
    { status: 400 }
  );
}
