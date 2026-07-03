/**
 * GET /api/vater/billing/usage?period=current|all&limit=100
 *
 * Returns the immutable VaterUsage ledger for the current user (or all-time).
 * Used by the Settings → Usage tab + the AnalyticsScreen Cost subview.
 */

import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getCurrentPeriod } from "@/lib/vater/billing/period";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  const url = new URL(request.url);
  const period = url.searchParams.get("period") ?? "current";
  const rawLimit = Number(url.searchParams.get("limit") ?? "100");
  const limit = Number.isFinite(rawLimit) ? Math.max(1, Math.min(500, rawLimit)) : 100;

  let where: { userId: string; ts?: { gte?: Date; lt?: Date } } = { userId };
  if (period === "current") {
    const p = await getCurrentPeriod(userId);
    where = {
      userId,
      ts: { gte: p.periodStart, ...(p.periodEnd ? { lt: p.periodEnd } : {}) },
    };
  }

  const items = await prisma.vaterUsage.findMany({
    where,
    orderBy: { ts: "desc" },
    take: limit,
  });

  // Aggregate breakdowns for charts
  const breakdownByAction = await prisma.vaterUsage.groupBy({
    by: ["action"],
    where,
    _sum: { costCents: true },
    _count: { _all: true },
  });
  const breakdownByTier = await prisma.vaterUsage.groupBy({
    by: ["tier"],
    where,
    _sum: { costCents: true },
    _count: { _all: true },
  });

  return NextResponse.json({
    items,
    totals: {
      cents: items.reduce((s, it) => s + it.costCents, 0),
      count: items.length,
    },
    breakdown: {
      byAction: breakdownByAction.map((r) => ({
        action: r.action,
        cents: r._sum.costCents ?? 0,
        count: r._count._all,
      })),
      byTier: breakdownByTier.map((r) => ({
        tier: r.tier,
        cents: r._sum.costCents ?? 0,
        count: r._count._all,
      })),
    },
  });
}
