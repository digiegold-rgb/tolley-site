/**
 * POST /api/leads/dossier/address — Run dossier research on a raw address
 *
 * Creates a manual listing record if one doesn't exist, then kicks off
 * the dossier pipeline. Returns the job ID for redirect to detail page.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth as getSession } from "@/auth";
import { runDossierPipeline } from "@/lib/dossier/pipeline";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { address, city, state, zip, ownerName } = body as {
    address?: string;
    city?: string;
    state?: string;
    zip?: string;
    ownerName?: string;
  };

  if (!address?.trim()) {
    return NextResponse.json({ error: "Address is required" }, { status: 400 });
  }

  const cleanAddress = address.trim();
  const cleanCity = city?.trim() || "";
  const cleanState = state?.trim() || "MO";
  const cleanZip = zip?.trim() || "";

  // Check if a listing already exists for this address
  let listing = await prisma.listing.findFirst({
    where: {
      address: { equals: cleanAddress, mode: "insensitive" },
      ...(cleanZip ? { zip: cleanZip } : {}),
    },
  });

  const cleanOwnerName = ownerName?.trim() || "";

  if (!listing) {
    // Create a manual listing
    const manualMlsId = `MANUAL-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    listing = await prisma.listing.create({
      data: {
        mlsId: manualMlsId,
        address: cleanAddress,
        city: cleanCity,
        state: cleanState,
        zip: cleanZip,
        status: "Manual Lookup",
        source: "manual",
        ...(cleanOwnerName ? { rawData: { ownerName: cleanOwnerName } } : {}),
      },
    });
  } else if (cleanOwnerName) {
    // Update existing listing with owner name if provided
    const existingRaw = (listing.rawData || {}) as Record<string, unknown>;
    if (!existingRaw.ownerName) {
      await prisma.listing.update({
        where: { id: listing.id },
        data: { rawData: { ...existingRaw, ownerName: cleanOwnerName } },
      });
    }
  }

  // Check for existing active dossier job
  const existingJob = await prisma.dossierJob.findFirst({
    where: {
      listingId: listing.id,
      status: { in: ["queued", "running"] },
    },
  });

  if (existingJob) {
    return NextResponse.json({
      ok: true,
      jobId: existingJob.id,
      existing: true,
    });
  }

  // Also check for a completed job (allow re-running if older than 24h)
  const recentCompleted = await prisma.dossierJob.findFirst({
    where: {
      listingId: listing.id,
      status: { in: ["complete", "partial"] },
      completedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    },
    orderBy: { completedAt: "desc" },
  });

  if (recentCompleted) {
    return NextResponse.json({
      ok: true,
      jobId: recentCompleted.id,
      existing: true,
      message: "Recent dossier exists (< 24h old)",
    });
  }

  // Create new dossier job
  const job = await prisma.dossierJob.create({
    data: {
      listingId: listing.id,
      status: "queued",
      requestedBy: session.user.id,
    },
  });

  // Fire-and-forget: start processing in the background
  // The pipeline updates job status in DB; the detail page polls for updates
  runDossierPipeline(job.id).catch((err) => {
    console.error(`[dossier-address] Pipeline failed for job ${job.id}:`, err);
  });

  return NextResponse.json({
    ok: true,
    jobId: job.id,
    listingId: listing.id,
    existing: false,
  });
}
