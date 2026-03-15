/**
 * GET /api/scan/summary — "The machine earned $X while you slept"
 *
 * Returns a text summary of overnight scan activity for the daily brief.
 * Also provides structured data for the dashboard.
 *
 * Auth: x-sync-secret or session
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  // Auth: session or sync secret
  const syncSecret = req.headers.get("x-sync-secret");
  const isSync = syncSecret && syncSecret === process.env.SYNC_SECRET;
  if (!isSync) {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterdayStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000);

  // Overnight = yesterday 6PM to today 6AM (main scanning window)
  const overnightStart = new Date(yesterdayStart);
  overnightStart.setHours(18, 0, 0, 0);
  const overnightEnd = new Date(todayStart);
  overnightEnd.setHours(6, 30, 0, 0);

  const [
    overnightRuns,
    overnightActivity,
    overnightRevenue,
    totalRevenue,
    // Scanner-specific stats
    newLeads24h,
    hotLeads,
    arbitragePairs24h,
    unclaimedFound24h,
    marketSignals,
    productAlerts24h,
  ] = await Promise.all([
    prisma.scanRun.findMany({
      where: { startedAt: { gte: overnightStart, lte: overnightEnd } },
      orderBy: { startedAt: "desc" },
    }),
    prisma.scanActivity.findMany({
      where: { createdAt: { gte: overnightStart, lte: overnightEnd } },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.scanRevenue.aggregate({
      _sum: { amount: true },
      where: { createdAt: { gte: yesterdayStart } },
    }),
    prisma.scanRevenue.aggregate({
      _sum: { amount: true },
    }),
    // Leads
    prisma.lead.count({
      where: { createdAt: { gte: yesterdayStart } },
    }),
    prisma.lead.count({
      where: { score: { gte: 70 } },
    }),
    // Arbitrage
    prisma.arbitragePair.count({
      where: { createdAt: { gte: yesterdayStart } },
    }),
    // Unclaimed
    prisma.unclaimedFund.aggregate({
      _sum: { amount: true },
      _count: { id: true },
      where: { createdAt: { gte: yesterdayStart } },
    }),
    // Market
    prisma.marketSignal.count({
      where: { active: true },
    }),
    // Products
    prisma.scanActivity.count({
      where: {
        scanner: "products",
        severity: { in: ["warning", "alert"] },
        createdAt: { gte: yesterdayStart },
      },
    }),
  ]);

  const overnightRevenueTotal = overnightRevenue._sum.amount ?? 0;
  const allTimeRevenue = totalRevenue._sum.amount ?? 0;

  // Build summary stats
  const scannerStats = {
    leads: {
      newLeads: newLeads24h,
      hotLeads,
      runsCompleted: overnightRuns.filter((r) => r.scanner === "leads" && r.status === "complete").length,
    },
    arbitrage: {
      pairsFound: arbitragePairs24h,
      runsCompleted: overnightRuns.filter((r) => r.scanner === "arbitrage" && r.status === "complete").length,
    },
    products: {
      alerts: productAlerts24h,
      runsCompleted: overnightRuns.filter((r) => r.scanner === "products" && r.status === "complete").length,
    },
    unclaimed: {
      fundsFound: unclaimedFound24h._count.id,
      amountFound: unclaimedFound24h._sum.amount ?? 0,
      runsCompleted: overnightRuns.filter((r) => r.scanner === "unclaimed" && r.status === "complete").length,
    },
    markets: {
      activeSignals: marketSignals,
      runsCompleted: overnightRuns.filter((r) => r.scanner === "markets" && r.status === "complete").length,
    },
  };

  // Build text summary for daily brief
  const lines: string[] = [];
  lines.push(`## Scan Command Center — Overnight Summary`);
  lines.push(``);

  const totalRuns = overnightRuns.length;
  const failedRuns = overnightRuns.filter((r) => r.status === "failed").length;
  lines.push(`**${totalRuns} scan runs** completed overnight (${failedRuns} failed)`);

  if (overnightRevenueTotal > 0) {
    lines.push(`**The machine earned $${overnightRevenueTotal.toFixed(2)} while you slept.**`);
  }

  lines.push(``);
  lines.push(`### By Scanner:`);

  if (scannerStats.leads.newLeads > 0) {
    lines.push(`- **Leads:** ${scannerStats.leads.newLeads} new leads found, ${scannerStats.leads.hotLeads} hot (score > 70)`);
  } else {
    lines.push(`- **Leads:** No new leads overnight`);
  }

  if (scannerStats.arbitrage.pairsFound > 0) {
    lines.push(`- **Arbitrage:** ${scannerStats.arbitrage.pairsFound} profitable pairs discovered`);
  } else {
    lines.push(`- **Arbitrage:** No new pairs found`);
  }

  if (scannerStats.unclaimed.fundsFound > 0) {
    lines.push(`- **Unclaimed:** ${scannerStats.unclaimed.fundsFound} funds found ($${scannerStats.unclaimed.amountFound.toFixed(0)})`);
  } else {
    lines.push(`- **Unclaimed:** No new funds found`);
  }

  lines.push(`- **Products:** ${scannerStats.products.alerts} stock alerts`);
  lines.push(`- **Markets:** ${scannerStats.markets.activeSignals} active signals`);

  if (allTimeRevenue > 0) {
    lines.push(``);
    lines.push(`**All-time tracked revenue: $${allTimeRevenue.toFixed(2)}**`);
  }

  // Key overnight events
  const alertEvents = overnightActivity.filter((a) => a.severity === "alert" || a.severity === "warning");
  if (alertEvents.length > 0) {
    lines.push(``);
    lines.push(`### Alerts:`);
    for (const e of alertEvents.slice(0, 5)) {
      lines.push(`- [${e.scanner}] ${e.title}`);
    }
  }

  const textSummary = lines.join("\n");

  return NextResponse.json({
    textSummary,
    stats: scannerStats,
    overnight: {
      runs: totalRuns,
      failed: failedRuns,
      revenue: overnightRevenueTotal,
    },
    allTimeRevenue,
  });
}
