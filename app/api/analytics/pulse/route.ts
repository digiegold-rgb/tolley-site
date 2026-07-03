import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { TRACKED_SITES } from "@/lib/analytics";
import type { PulseResponse } from "@/components/analytics/shared/types";

export const dynamic = "force-dynamic";

const FOOD_ANNUAL_PRICE_CENTS = 3900;
const KNOWN_HEARTBEAT_CRONS: { path: string; schedule: string; cadenceMin: number; check: () => Promise<Date | null> }[] = [
  {
    path: "/api/cron/mls-sync",
    schedule: "0 */4 * * *",
    cadenceMin: 240,
    check: async () => {
      const r = await prisma.syncLog.findFirst({
        where: { source: { contains: "mls" } },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      });
      return r?.createdAt ?? null;
    },
  },
  {
    path: "/api/cron/dossier-process",
    schedule: "*/2 * * * *",
    cadenceMin: 2,
    check: async () => {
      const r = await prisma.dossierJob.findFirst({
        orderBy: { updatedAt: "desc" },
        select: { updatedAt: true },
      });
      return r?.updatedAt ?? null;
    },
  },
  {
    path: "/api/cron/ai-overview-check",
    schedule: "0 8 * * *",
    cadenceMin: 1440,
    check: async () => {
      const r = await prisma.aiOverviewCheck.findFirst({
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      });
      return r?.createdAt ?? null;
    },
  },
  {
    path: "/api/cron/probate-scan",
    schedule: "0 9 * * *",
    cadenceMin: 1440,
    check: async () => {
      const r = await prisma.probateSignal.findFirst({
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      });
      return r?.createdAt ?? null;
    },
  },
  {
    path: "/api/cron/maps-pack-track",
    schedule: "0 7 * * 3",
    cadenceMin: 7 * 1440,
    check: async () => {
      const r = await prisma.mapsPackRank.findFirst({
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      });
      return r?.createdAt ?? null;
    },
  },
  {
    path: "/api/cron/deal-review-blast",
    schedule: "0 10 * * *",
    cadenceMin: 1440,
    check: async () => {
      const r = await prisma.reviewRequest.findFirst({
        where: { sourceType: "deal" },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      });
      return r?.createdAt ?? null;
    },
  },
  {
    path: "/api/cron/vater-rss-poll",
    schedule: "*/15 * * * *",
    cadenceMin: 15,
    check: async () => {
      const r = await prisma.vaterRssItem.findFirst({
        orderBy: { discoveredAt: "desc" },
        select: { discoveredAt: true },
      });
      return r?.discoveredAt ?? null;
    },
  },
  {
    path: "/api/cron/pools-intelligence",
    schedule: "0 4 * * *",
    cadenceMin: 1440,
    check: async () => {
      const r = await prisma.poolInsight.findFirst({
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      });
      return r?.createdAt ?? null;
    },
  },
];

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const errors: string[] = [];
  const now = new Date();
  const startOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const startOfYesterday = new Date(startOfToday.getTime() - 86_400_000);
  const dayAgo = new Date(now.getTime() - 86_400_000);
  const weekAgo = new Date(now.getTime() - 7 * 86_400_000);
  const fourteenAgo = new Date(now.getTime() - 14 * 86_400_000);

  // ─── KPIs ───────────────────────────────────────────────
  type KpiResult = {
    revenueTodayCents: number;
    revenueYesterdayCents: number;
    newSubsToday: number;
    leads24h: number;
    sessionsToday: number;
    activeSubs: number;
  };

  const results = await Promise.allSettled([
    // 0: WD payment revenue today
    prisma.wdPayment.aggregate({
      _sum: { amount: true },
      where: { createdAt: { gte: startOfToday } },
    }),
    // 1: WD payment revenue yesterday
    prisma.wdPayment.aggregate({
      _sum: { amount: true },
      where: { createdAt: { gte: startOfYesterday, lt: startOfToday } },
    }),
    // 2: New paid subs today (Subscription + FoodHousehold)
    prisma.subscription.count({
      where: { createdAt: { gte: startOfToday }, status: { in: ["active", "trialing"] } },
    }),
    // 3: Food signups today
    prisma.foodHousehold.count({
      where: { createdAt: { gte: startOfToday }, subscriptionStatus: { in: ["active", "trialing"] } },
    }),
    // 4: Leads created last 24h
    prisma.lead.count({ where: { createdAt: { gte: dayAgo } } }),
    // 5: Sessions today (distinct ipHash)
    prisma.siteView.findMany({
      where: { createdAt: { gte: startOfToday } },
      select: { ipHash: true },
      take: 50_000,
    }),
    // 6: Active subs total
    prisma.subscription.count({ where: { status: "active" } }),
    // 7: Pipeline — dossiers today
    prisma.dossierJob.count({ where: { createdAt: { gte: startOfToday } } }),
    prisma.dossierJob.count({ where: { createdAt: { gte: weekAgo } } }),
    // 9: Pipeline — sms messages today
    prisma.smsMessage.count({ where: { createdAt: { gte: startOfToday }, direction: "outbound" } }),
    prisma.smsMessage.count({ where: { createdAt: { gte: weekAgo }, direction: "outbound" } }),
    // 11: Review requests today/week
    prisma.reviewRequest.count({ where: { createdAt: { gte: startOfToday } } }),
    prisma.reviewRequest.count({ where: { createdAt: { gte: weekAgo } } }),
    // 13: Deals closed today/week
    prisma.deal.count({ where: { stage: "closed_won", updatedAt: { gte: startOfToday } } }),
    prisma.deal.count({ where: { stage: "closed_won", updatedAt: { gte: weekAgo } } }),
    // 15: Leads today (for funnel)
    prisma.lead.count({ where: { createdAt: { gte: startOfToday } } }),
    prisma.lead.count({ where: { createdAt: { gte: weekAgo } } }),
    // 17: WD payments last 14 days (daily)
    prisma.wdPayment.findMany({
      where: { createdAt: { gte: fourteenAgo } },
      select: { amount: true, createdAt: true },
    }),
    // 18: Subscriptions last 14 days (count by day)
    prisma.subscription.findMany({
      where: { createdAt: { gte: fourteenAgo } },
      select: { createdAt: true, status: true },
    }),
    // 19: SiteView today by site
    prisma.siteView.groupBy({
      by: ["site"],
      where: { createdAt: { gte: startOfToday } },
      _count: { _all: true },
      orderBy: { _count: { site: "desc" } },
      take: 5,
    }),
    // 20: SiteView same day last week (for WoW arrows)
    prisma.siteView.groupBy({
      by: ["site"],
      where: {
        createdAt: {
          gte: new Date(startOfToday.getTime() - 7 * 86_400_000),
          lt: new Date(startOfToday.getTime() - 6 * 86_400_000),
        },
      },
      _count: { _all: true },
    }),
  ]);

  const num = (i: number, fallback = 0): number => {
    const r = results[i];
    if (r.status !== "fulfilled") {
      errors.push(`q${i}: ${r.reason}`);
      return fallback;
    }
    return typeof r.value === "number" ? r.value : fallback;
  };

  const wdToday = (results[0].status === "fulfilled" ? (results[0].value as { _sum: { amount: number | null } })._sum.amount ?? 0 : 0);
  const wdYesterday = (results[1].status === "fulfilled" ? (results[1].value as { _sum: { amount: number | null } })._sum.amount ?? 0 : 0);
  const newSubsCore = num(2);
  const newFoodSubs = num(3);
  const leads24 = num(4);
  const sessionRows = (results[5].status === "fulfilled" ? results[5].value as { ipHash: string | null }[] : []);
  const sessionsToday = new Set(sessionRows.map((r) => r.ipHash).filter(Boolean)).size;
  const activeSubs = num(6);

  const kpis: PulseResponse["kpis"] = {
    revenueTodayCents: Math.round(wdToday * 100) + newFoodSubs * FOOD_ANNUAL_PRICE_CENTS,
    revenueYesterdayCents: Math.round(wdYesterday * 100),
    newSubsToday: newSubsCore + newFoodSubs,
    leads24h: leads24,
    sessionsToday,
    cronOk24h: 0,
    cronTotal24h: 0,
    cashBalanceCents: activeSubs, // repurposed: total active subs (across all products)
  };

  // ─── Pipeline funnel ───
  const leadsToday = num(15);
  const leadsWeek = num(16);
  const dossiersToday = num(7);
  const dossiersWeek = num(8);
  const smsToday = num(9);
  const smsWeek = num(10);
  const reviewToday = num(11);
  const reviewWeek = num(12);
  const dealsToday = num(13);
  const dealsWeek = num(14);

  const pipeline = [
    { label: "Leads", today: leadsToday, week: leadsWeek },
    { label: "Dossiers", today: dossiersToday, week: dossiersWeek },
    { label: "SMS sent", today: smsToday, week: smsWeek },
    { label: "Reviews req'd", today: reviewToday, week: reviewWeek },
    { label: "Deals closed", today: dealsToday, week: dealsWeek },
  ];

  // ─── Money daily 14d (WD payments + sub signups) ───
  const wdRows = (results[17].status === "fulfilled" ? results[17].value as { amount: number; createdAt: Date }[] : []);
  const subRows = (results[18].status === "fulfilled" ? results[18].value as { createdAt: Date; status: string }[] : []);
  const moneyDaily14d: PulseResponse["moneyDaily14d"] = [];
  for (let i = 13; i >= 0; i--) {
    const dStart = new Date(startOfToday.getTime() - i * 86_400_000);
    const dEnd = new Date(dStart.getTime() + 86_400_000);
    const wdSum = wdRows
      .filter((r) => r.createdAt >= dStart && r.createdAt < dEnd)
      .reduce((s, r) => s + r.amount, 0);
    const subCount = subRows.filter((r) => r.createdAt >= dStart && r.createdAt < dEnd).length;
    moneyDaily14d.push({
      date: dStart.toISOString().slice(0, 10),
      total: wdSum + subCount * (FOOD_ANNUAL_PRICE_CENTS / 100),
      byBusiness: { wd: wdSum, subs: subCount * (FOOD_ANNUAL_PRICE_CENTS / 100) },
    });
  }

  // ─── Top sites today ───
  const todaySites = (results[19].status === "fulfilled"
    ? results[19].value as { site: string; _count: { _all: number } }[]
    : []);
  const lastWeekSites = (results[20].status === "fulfilled"
    ? results[20].value as { site: string; _count: { _all: number } }[]
    : []);
  const lastWeekMap = new Map(lastWeekSites.map((s) => [s.site, s._count._all]));
  const topSitesToday = todaySites.map((s) => {
    const meta = TRACKED_SITES.find((t) => t.id === s.site);
    return {
      site: s.site,
      label: meta?.label ?? s.site,
      sessions: s._count._all,
      weekAgo: lastWeekMap.get(s.site) ?? 0,
    };
  });

  // ─── Cron heartbeat ───
  const cronChecks = await Promise.allSettled(
    KNOWN_HEARTBEAT_CRONS.map(async (c) => {
      const last = await c.check();
      const ageMin = last ? (now.getTime() - last.getTime()) / 60_000 : null;
      // Healthy if last run within 1.5x cadence
      const healthy = ageMin !== null && ageMin <= c.cadenceMin * 1.5;
      const expectedRunsToday = Math.max(1, Math.floor(1440 / c.cadenceMin));
      // Approximate actual: 1 if healthy, 0 if not (since we only have last-run timestamp)
      return {
        path: c.path,
        schedule: c.schedule,
        expectedRunsToday,
        actualRunsToday: healthy ? expectedRunsToday : 0,
        lastRun: last?.toISOString() ?? null,
        healthy,
      };
    }),
  );
  const cronStatus: PulseResponse["cronStatus"] = cronChecks
    .filter((r): r is PromiseFulfilledResult<PulseResponse["cronStatus"][number]> => r.status === "fulfilled")
    .map((r) => r.value);
  const okCount = cronStatus.filter((c) => c.healthy).length;
  kpis.cronOk24h = okCount;
  kpis.cronTotal24h = cronStatus.length;

  const body: PulseResponse = {
    generatedAt: now.toISOString(),
    kpis,
    moneyDaily14d,
    cronStatus,
    pipeline,
    topSitesToday,
    errors,
  };

  return NextResponse.json(body, {
    headers: { "Cache-Control": "private, max-age=60" },
  });
}
