/**
 * GET /api/leads/narrpr/status
 * Returns import history, match rates, and unmatched records.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  // Auth: SYNC_SECRET or session
  const { searchParams } = new URL(req.url);
  const key = searchParams.get("key");
  const hasKeyAuth = key === process.env.SYNC_SECRET;

  if (!hasKeyAuth) {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const [total, matched, unmatched, merged, pending, recentImports] =
    await Promise.all([
      prisma.narrprImport.count(),
      prisma.narrprImport.count({ where: { status: "matched" } }),
      prisma.narrprImport.count({ where: { status: "unmatched" } }),
      prisma.narrprImport.count({ where: { status: "merged" } }),
      prisma.narrprImport.count({ where: { status: "pending" } }),
      prisma.narrprImport.findMany({
        orderBy: { createdAt: "desc" },
        take: 50,
        select: {
          id: true,
          importType: true,
          address: true,
          city: true,
          zip: true,
          status: true,
          matchedListingId: true,
          matchConfidence: true,
          ownerName: true,
          createdAt: true,
          mergedAt: true,
        },
      }),
    ]);

  return NextResponse.json({
    totalImports: total,
    matched,
    unmatched,
    merged,
    pending,
    matchRate: total > 0 ? Math.round((matched / total) * 100) : 0,
    mergeRate: matched > 0 ? Math.round((merged / matched) * 100) : 0,
    recentImports: recentImports.map((r) => ({
      ...r,
      createdAt: r.createdAt.toISOString(),
      mergedAt: r.mergedAt?.toISOString() || null,
    })),
  });
}
