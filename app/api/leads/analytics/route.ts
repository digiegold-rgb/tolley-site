import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/**
 * GET /api/leads/analytics
 *
 * Returns funnel data, activity logs, and ROI metrics.
 * Query: ?days=30 (default 30)
 */
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sub = await prisma.leadSubscriber.findUnique({
    where: { userId: session.user.id },
    select: {
      id: true,
      tier: true,
      smsUsed: true,
      smsLimit: true,
      referralFeesEarned: true,
      referralFeesPending: true,
      dailyContactGoal: true,
      createdAt: true,
    },
  });
  if (!sub) {
    return NextResponse.json({ error: "No subscription" }, { status: 403 });
  }

  const days = Math.min(Number(request.nextUrl.searchParams.get("days")) || 30, 90);
  const since = new Date();
  since.setDate(since.getDate() - days);

  // Funnel — all leads for this subscriber's farm area
  const [funnel, activity, conversations, recentLeads] = await Promise.all([
    // Lead funnel counts by status
    prisma.lead.groupBy({
      by: ["status"],
      _count: { id: true },
    }),

    // Activity logs for the period
    prisma.activityLog.findMany({
      where: {
        subscriberId: sub.id,
        activityDate: { gte: since },
      },
      orderBy: { activityDate: "asc" },
    }),

    // Conversation stats
    prisma.smsConversation.groupBy({
      by: ["status"],
      where: { subscriberId: sub.id },
      _count: { id: true },
    }),

    // Recent converted leads with referral fees
    prisma.lead.findMany({
      where: {
        status: { in: ["referred", "closed"] },
        referralFee: { not: null },
        updatedAt: { gte: since },
      },
      select: {
        id: true,
        status: true,
        referralFee: true,
        referralStatus: true,
        referredTo: true,
        closedAt: true,
        listing: { select: { address: true, city: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: 20,
    }),
  ]);

  // Compute aggregates
  const funnelMap: Record<string, number> = {};
  for (const f of funnel) {
    funnelMap[f.status] = f._count.id;
  }

  const totalLeads = Object.values(funnelMap).reduce((a, b) => a + b, 0);
  const contacted = (funnelMap.contacted || 0) + (funnelMap.interested || 0) + (funnelMap.referred || 0) + (funnelMap.closed || 0);
  const converted = (funnelMap.referred || 0) + (funnelMap.closed || 0);

  // Activity totals
  const activityTotals = {
    contactsMade: 0,
    smsSent: 0,
    smsReplies: 0,
    leadsContacted: 0,
    leadsConverted: 0,
    dossiersRun: 0,
    newLeads: 0,
  };
  for (const a of activity) {
    activityTotals.contactsMade += a.contactsMade;
    activityTotals.smsSent += a.smsSent;
    activityTotals.smsReplies += a.smsReplies;
    activityTotals.leadsContacted += a.leadsContacted;
    activityTotals.leadsConverted += a.leadsConverted;
    activityTotals.dossiersRun += a.dossiersRun;
    activityTotals.newLeads += a.newLeads;
  }

  // Today's activity
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayLog = activity.find(
    (a) => new Date(a.activityDate).toDateString() === today.toDateString()
  );

  // Response rate
  const responseRate = activityTotals.smsSent > 0
    ? Math.round((activityTotals.smsReplies / activityTotals.smsSent) * 100)
    : 0;

  // Conversion rate
  const conversionRate = totalLeads > 0
    ? Math.round((converted / totalLeads) * 100)
    : 0;

  // Monthly cost (based on tier)
  const monthlyCost = sub.tier === "team" ? 199 : sub.tier === "pro" ? 99 : 49;
  const costPerLead = totalLeads > 0 ? Math.round((monthlyCost / totalLeads) * 100) / 100 : 0;

  return NextResponse.json({
    funnel: funnelMap,
    totals: {
      leads: totalLeads,
      contacted,
      converted,
      responseRate,
      conversionRate,
      costPerLead,
      monthlyCost,
    },
    roi: {
      feesEarned: sub.referralFeesEarned,
      feesPending: sub.referralFeesPending,
      totalReturn: sub.referralFeesEarned + sub.referralFeesPending,
    },
    activity: activity.map((a) => ({
      ...a,
      activityDate: a.activityDate.toISOString(),
    })),
    activityTotals,
    today: todayLog ? {
      contactsMade: todayLog.contactsMade,
      goal: sub.dailyContactGoal,
      smsSent: todayLog.smsSent,
      smsReplies: todayLog.smsReplies,
    } : {
      contactsMade: 0,
      goal: sub.dailyContactGoal,
      smsSent: 0,
      smsReplies: 0,
    },
    conversations: Object.fromEntries(conversations.map((c) => [c.status, c._count.id])),
    recentDeals: recentLeads,
    days,
  });
}

/**
 * PATCH /api/leads/analytics
 * Update subscriber ROI settings (dailyContactGoal, referral fees).
 */
export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { dailyContactGoal, referralFeesEarned, referralFeesPending, weeklyDigestEnabled } = body;

  const data: Record<string, unknown> = {};
  if (dailyContactGoal !== undefined) data.dailyContactGoal = Math.max(1, Math.min(100, dailyContactGoal));
  if (referralFeesEarned !== undefined) data.referralFeesEarned = Math.max(0, referralFeesEarned);
  if (referralFeesPending !== undefined) data.referralFeesPending = Math.max(0, referralFeesPending);
  if (weeklyDigestEnabled !== undefined) data.weeklyDigestEnabled = weeklyDigestEnabled;

  await prisma.leadSubscriber.update({
    where: { userId: session.user.id },
    data,
  });

  return NextResponse.json({ ok: true });
}
