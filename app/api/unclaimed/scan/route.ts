/**
 * POST /api/unclaimed/scan — Create a new unclaimed funds scan
 * GET  /api/unclaimed/scan — List scans for current user
 */

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getLeadsTierLimits } from "@/lib/leads-subscription";
import type { LeadsTier } from "@/lib/leads-subscription";

const RESEARCH_WORKER_URL =
  process.env.RESEARCH_WORKER_URL || "http://localhost:8900";
const SYNC_SECRET = process.env.SYNC_SECRET || "";

// Fund scan limits per tier
function getFundScanLimit(tier: LeadsTier): number {
  switch (tier) {
    case "starter":
      return 0; // dossier-integrated only
    case "pro":
      return 10;
    case "team":
      return 50;
    default:
      return 0;
  }
}

export async function POST(req: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "LOGIN_REQUIRED" }, { status: 401 });
  }

  const body = await req.json();
  const { ownerName, alternateNames, sources, listingId, dossierJobId } = body;

  if (!ownerName || typeof ownerName !== "string" || !ownerName.trim()) {
    return NextResponse.json(
      { error: "ownerName is required" },
      { status: 400 }
    );
  }

  // Check subscription & billing limits
  const sub = await prisma.leadSubscriber.findUnique({
    where: { userId },
  });

  if (!sub || sub.status !== "active") {
    return NextResponse.json(
      { error: "Active subscription required" },
      { status: 403 }
    );
  }

  const tier = sub.tier as LeadsTier;
  const limit = getFundScanLimit(tier);

  // Standalone scans check billing (dossier-triggered scans bypass this)
  if (!dossierJobId) {
    if (limit === 0) {
      return NextResponse.json(
        {
          error: "TIER_LIMIT",
          message:
            "Standalone unclaimed fund scans require Pro or Team tier. Upgrade to access.",
        },
        { status: 403 }
      );
    }

    if (sub.fundScanUsed >= limit) {
      return NextResponse.json(
        {
          error: "SCAN_LIMIT_REACHED",
          message: `Monthly scan limit reached (${sub.fundScanUsed}/${limit}). Resets on the 1st.`,
        },
        { status: 429 }
      );
    }
  }

  // Create scan record
  const scan = await prisma.unclaimedFundScan.create({
    data: {
      userId,
      subscriberId: sub.id,
      ownerName: ownerName.trim(),
      alternateNames: alternateNames || [],
      sources: sources || [
        "mo_unclaimed",
        "mo_tax_surplus",
        "ks_unclaimed",
      ],
      listingId: listingId || null,
      dossierJobId: dossierJobId || null,
      status: "pending",
    },
  });

  // Increment usage counter (only for standalone scans)
  if (!dossierJobId) {
    await prisma.leadSubscriber.update({
      where: { id: sub.id },
      data: { fundScanUsed: { increment: 1 } },
    });
  }

  // Build callback URL for the research worker
  const baseUrl = process.env.NEXTAUTH_URL || process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "http://localhost:3000";
  const callbackUrl = `${baseUrl}/api/unclaimed/callback`;

  // Dispatch to research worker (async — don't await)
  fetch(`${RESEARCH_WORKER_URL}/unclaimed-funds`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-sync-secret": SYNC_SECRET,
    },
    body: JSON.stringify({
      scanId: scan.id,
      ownerName: ownerName.trim(),
      alternateNames: alternateNames || [],
      sources: sources || ["mo_unclaimed", "mo_tax_surplus", "ks_unclaimed"],
      callbackUrl,
    }),
  })
    .then(() => {
      console.log(`[unclaimed/scan] Dispatched scan ${scan.id} to research worker`);
    })
    .catch((e) => {
      console.error(`[unclaimed/scan] Failed to dispatch scan ${scan.id}:`, e);
      // Mark as failed
      prisma.unclaimedFundScan
        .update({
          where: { id: scan.id },
          data: {
            status: "failed",
            errorMessage: `Research worker dispatch failed: ${String(e)}`,
          },
        })
        .catch(() => {});
    });

  // Update status to running
  await prisma.unclaimedFundScan.update({
    where: { id: scan.id },
    data: { status: "running" },
  });

  return NextResponse.json({
    ok: true,
    scanId: scan.id,
    status: "running",
    ownerName: ownerName.trim(),
    usage: dossierJobId
      ? null
      : { used: sub.fundScanUsed + 1, limit },
  });
}

export async function GET(req: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "LOGIN_REQUIRED" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 100);
  const offset = parseInt(searchParams.get("offset") || "0");

  const where: Record<string, unknown> = { userId };
  if (status) where.status = status;

  const [scans, total] = await Promise.all([
    prisma.unclaimedFundScan.findMany({
      where,
      include: {
        funds: {
          select: {
            id: true,
            source: true,
            amount: true,
            ownerName: true,
            matchConfidence: true,
            claim: { select: { id: true, status: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.unclaimedFundScan.count({ where }),
  ]);

  return NextResponse.json({ scans, total, limit, offset });
}
