import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [
    totalLeads,
    leadsByStatus,
    leadsBySource,
    recentLeads,
    dossierStats,
    dossiersByStatus,
    subscribers,
    subscribersByTier,
    dailyLeads,
    dailyDossiers,
    batchStats,
  ] = await Promise.all([
    // Total leads
    prisma.lead.count(),

    // Leads by status
    prisma.lead.groupBy({
      by: ["status"],
      _count: true,
      orderBy: { _count: { status: "desc" } },
    }),

    // Leads by source
    prisma.lead.groupBy({
      by: ["source"],
      _count: true,
      orderBy: { _count: { source: "desc" } },
    }),

    // Recent leads (last 30 days)
    prisma.lead.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),

    // Total dossier jobs
    prisma.dossierJob.count(),

    // Dossier jobs by status
    prisma.dossierJob.groupBy({
      by: ["status"],
      _count: true,
      orderBy: { _count: { status: "desc" } },
    }),

    // Subscriber count
    prisma.leadSubscriber.count(),

    // Subscribers by tier
    prisma.leadSubscriber.groupBy({
      by: ["tier"],
      _count: true,
      orderBy: { _count: { tier: "desc" } },
    }),

    // Daily lead creation (last 30d)
    prisma.$queryRaw<{ date: string; count: bigint }[]>`
      SELECT
        TO_CHAR("createdAt", 'YYYY-MM-DD') as date,
        COUNT(*)::bigint as count
      FROM "Lead"
      WHERE "createdAt" >= ${thirtyDaysAgo}
      GROUP BY TO_CHAR("createdAt", 'YYYY-MM-DD')
      ORDER BY date ASC
    `,

    // Daily dossier completions (last 30d)
    prisma.$queryRaw<{ date: string; count: bigint }[]>`
      SELECT
        TO_CHAR("completedAt", 'YYYY-MM-DD') as date,
        COUNT(*)::bigint as count
      FROM "DossierJob"
      WHERE "completedAt" >= ${thirtyDaysAgo}
      GROUP BY TO_CHAR("completedAt", 'YYYY-MM-DD')
      ORDER BY date ASC
    `,

    // Batch stats
    prisma.dossierBatch.aggregate({
      _count: true,
      _sum: { totalRows: true, processedRows: true, failedRows: true },
    }),
  ]);

  // Referral revenue
  const referralAgg = await prisma.leadSubscriber.aggregate({
    _sum: { referralFeesEarned: true, referralFeesPending: true },
  });

  // Top motivation scores
  const topMotivated = await prisma.lead.findMany({
    where: { score: { gte: 50 } },
    select: { id: true, ownerName: true, score: true, status: true, source: true, createdAt: true },
    orderBy: { score: "desc" },
    take: 10,
  });

  // SMS usage across subscribers
  const smsAgg = await prisma.leadSubscriber.aggregate({
    _sum: { smsUsed: true, smsLimit: true, snapUsed: true, snapLimit: true },
  });

  return NextResponse.json({
    overview: {
      totalLeads,
      recentLeads,
      totalDossiers: dossierStats,
      totalSubscribers: subscribers,
      referralFeesEarned: referralAgg._sum.referralFeesEarned || 0,
      referralFeesPending: referralAgg._sum.referralFeesPending || 0,
      smsUsed: smsAgg._sum.smsUsed || 0,
      smsLimit: smsAgg._sum.smsLimit || 0,
      snapUsed: smsAgg._sum.snapUsed || 0,
      snapLimit: smsAgg._sum.snapLimit || 0,
    },
    leadsByStatus: leadsByStatus.map((s) => ({ status: s.status, count: s._count })),
    leadsBySource: leadsBySource.map((s) => ({ source: s.source || "unknown", count: s._count })),
    dossiersByStatus: dossiersByStatus.map((s) => ({ status: s.status, count: s._count })),
    subscribersByTier: subscribersByTier.map((s) => ({ tier: s.tier, count: s._count })),
    dailyLeads: dailyLeads.map((d) => ({ date: d.date, count: Number(d.count) })),
    dailyDossiers: dailyDossiers.map((d) => ({ date: d.date, count: Number(d.count) })),
    batches: {
      total: batchStats._count,
      totalRows: batchStats._sum.totalRows || 0,
      processedRows: batchStats._sum.processedRows || 0,
      failedRows: batchStats._sum.failedRows || 0,
    },
    topMotivated,
  });
}
