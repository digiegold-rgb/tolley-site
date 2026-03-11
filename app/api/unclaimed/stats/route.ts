/**
 * GET /api/unclaimed/stats — Dashboard statistics
 */

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "LOGIN_REQUIRED" }, { status: 401 });
  }

  const sub = await prisma.leadSubscriber.findUnique({
    where: { userId },
  });

  if (!sub) {
    return NextResponse.json({ error: "No subscription" }, { status: 403 });
  }

  const [totalScans, completedScans, totalFunds, claimableStats, activeClaims] =
    await Promise.all([
      prisma.unclaimedFundScan.count({ where: { userId } }),
      prisma.unclaimedFundScan.count({
        where: { userId, status: "complete" },
      }),
      prisma.unclaimedFund.count({
        where: { scan: { userId } },
      }),
      prisma.unclaimedFundScan.aggregate({
        where: { userId, status: "complete" },
        _sum: { claimableAmount: true, totalFound: true },
      }),
      prisma.unclaimedFundClaim.count({
        where: {
          subscriberId: sub.id,
          status: { notIn: ["paid", "identified"] },
        },
      }),
    ]);

  return NextResponse.json({
    totalScans,
    completedScans,
    totalFunds,
    totalClaimableAmount: claimableStats._sum.claimableAmount || 0,
    activeClaims,
    usage: {
      fundScanUsed: sub.fundScanUsed,
      fundScanLimit: sub.fundScanLimit,
    },
  });
}
