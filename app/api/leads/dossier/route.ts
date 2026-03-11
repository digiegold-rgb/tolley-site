/**
 * POST /api/leads/dossier — Request dossier research for 1-5 properties
 * GET  /api/leads/dossier — List all dossier jobs with status
 *
 * Auth: x-sync-secret header
 */

import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getPluginManifest } from "@/lib/dossier/plugins/registry";
import { auth as getSession } from "@/auth";

const prisma = new PrismaClient();

async function checkAuth(req: NextRequest): Promise<boolean> {
  const secret = req.headers.get("x-sync-secret");
  if (secret && secret === process.env.SYNC_SECRET) return true;
  const session = await getSession();
  return Boolean(session?.user?.id);
}

// ── POST: Request new dossier research ──────────────────────

export async function POST(req: NextRequest) {
  if (!(await checkAuth(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { listingIds, leadIds } = body as {
    listingIds?: string[];
    leadIds?: string[];
  };

  if (!listingIds?.length && !leadIds?.length) {
    return NextResponse.json(
      { error: "Provide listingIds or leadIds (max 5)" },
      { status: 400 }
    );
  }

  // Resolve listing IDs from lead IDs if needed
  let resolvedListingIds = listingIds || [];
  const leadIdMap: Record<string, string> = {};

  if (leadIds?.length) {
    const leads = await prisma.lead.findMany({
      where: { id: { in: leadIds } },
      select: { id: true, listingId: true },
    });
    for (const lead of leads) {
      if (lead.listingId) {
        resolvedListingIds.push(lead.listingId);
        leadIdMap[lead.listingId] = lead.id;
      }
    }
  }

  // Dedupe and limit
  resolvedListingIds = [...new Set(resolvedListingIds)].slice(0, 5);

  if (resolvedListingIds.length === 0) {
    return NextResponse.json({ error: "No valid listings found" }, { status: 400 });
  }

  // Check listings exist
  const listings = await prisma.listing.findMany({
    where: { id: { in: resolvedListingIds } },
    select: { id: true, address: true },
  });

  if (listings.length === 0) {
    return NextResponse.json({ error: "No listings found for given IDs" }, { status: 404 });
  }

  // Check for existing active jobs (don't double-queue)
  const existingJobs = await prisma.dossierJob.findMany({
    where: {
      listingId: { in: listings.map((l) => l.id) },
      status: { in: ["queued", "running"] },
    },
  });
  const activeListingIds = new Set(existingJobs.map((j) => j.listingId));

  // Create jobs for listings that don't already have active ones
  const newJobs = [];
  for (const listing of listings) {
    if (activeListingIds.has(listing.id)) continue;

    const job = await prisma.dossierJob.create({
      data: {
        listingId: listing.id,
        leadId: leadIdMap[listing.id] || null,
        status: "queued",
        requestedBy: "admin",
      },
    });
    newJobs.push(job);
  }

  return NextResponse.json({
    ok: true,
    created: newJobs.length,
    skipped: listings.length - newJobs.length,
    skippedReason: activeListingIds.size > 0 ? "Already queued or running" : undefined,
    jobs: newJobs.map((j) => ({ id: j.id, listingId: j.listingId, status: j.status })),
    plugins: getPluginManifest(),
  });
}

// ── GET: List dossier jobs ──────────────────────────────────

export async function GET(req: NextRequest) {
  if (!(await checkAuth(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status"); // filter by status
  const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 50);
  const offset = parseInt(searchParams.get("offset") || "0");

  const where = status ? { status } : {};

  const [jobs, total] = await Promise.all([
    prisma.dossierJob.findMany({
      where,
      include: {
        listing: {
          select: {
            address: true,
            city: true,
            zip: true,
            listPrice: true,
            mlsId: true,
            photoUrls: true,
          },
        },
        result: {
          select: {
            motivationScore: true,
            motivationFlags: true,
            owners: true,
            entityType: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.dossierJob.count({ where }),
  ]);

  return NextResponse.json({
    jobs,
    total,
    limit,
    offset,
    plugins: getPluginManifest(),
  });
}
