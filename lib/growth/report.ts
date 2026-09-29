import { prisma } from "@/lib/prisma";
import { reportWindow } from "./core";
import { contribution, ledgerSchema } from "@/lib/live/core";
export async function growthReport(period: string) {
  const { since, until } = reportWindow(period);
  const range = { gte: since, lt: until };
  const [controls, settings, activity, campaigns, clips, shows, clicks, stories, impact, health, inquiries, visits, daily] = await Promise.all([
    prisma.growthAutomation.findUnique({ where: { id: "owner" } }),
    prisma.liveSettings.findUnique({ where: { id: "treasure-hauls" }, select: { bindings: true, publishingPaused: true, campaignPaused: true } }),
    prisma.growthActivity.findMany({ where: { createdAt: range }, orderBy: { createdAt: "desc" }, take: 500 }),
    prisma.liveCampaignPost.findMany({ where: { OR: [{ dueAt: range }, { updatedAt: range }] }, orderBy: { dueAt: "desc" }, take: 500 }),
    prisma.livePublication.findMany({ where: { createdAt: range }, include: { clip: { select: { title: true, showId: true } } }, orderBy: { createdAt: "desc" }, take: 500 }),
    prisma.liveShow.findMany({ where: { startsAt: range }, orderBy: { startsAt: "desc" } }),
    prisma.siteEvent.groupBy({ by: ["event", "label"], where: { site: "live", event: { in: ["show_click", "referral_click", "impact_click", "campaign_visit", "whatnot_click"] }, createdAt: range }, _count: true }),
    prisma.buildStory.findMany({ where: { createdAt: range }, select: { id: true, slug: true, title: true, status: true, publishedAt: true, notificationStatus: true, retrospective: true }, orderBy: { createdAt: "desc" } }),
    prisma.siteEvent.findFirst({ where: { site: "live", event: "impact_snapshot" }, orderBy: { createdAt: "desc" }, select: { meta: true, createdAt: true } }),
    prisma.growthActivity.findMany({ where: { id: { in: ["clip-worker-health", "blog-worker-health", "cordport-tool-health"] } } }),
    prisma.growthLead.count({ where: { offer: "live", createdAt: range } }),
    prisma.siteView.groupBy({ by: ["site", "audience"], where: { site: { in: ["live", "blog"] }, createdAt: range }, _count: true }),
    prisma.$queryRaw<{ day: string; posts: number; clicks: number; views: number; inquiries: number; stories: number }[]>`
      SELECT day, SUM(posts)::int AS posts, SUM(clicks)::int AS clicks, SUM(views)::int AS views,
        SUM(inquiries)::int AS inquiries, SUM(stories)::int AS stories FROM (
        SELECT to_char("updatedAt" AT TIME ZONE 'UTC' AT TIME ZONE 'America/Chicago','YYYY-MM-DD') AS day, COUNT(*)::int AS posts, 0 AS clicks, 0 AS views, 0 AS inquiries, 0 AS stories
          FROM "LiveCampaignPost" WHERE status='posted' AND "updatedAt">=${since} AND "updatedAt"<${until} GROUP BY day
        UNION ALL SELECT to_char("updatedAt" AT TIME ZONE 'UTC' AT TIME ZONE 'America/Chicago','YYYY-MM-DD'), COUNT(*)::int,0,0,0,0
          FROM "LivePublication" WHERE status='posted' AND "updatedAt">=${since} AND "updatedAt"<${until} GROUP BY 1
        UNION ALL SELECT to_char("createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'America/Chicago','YYYY-MM-DD'),0,COUNT(*)::int,0,0,0
          FROM "SiteEvent" WHERE site='live' AND event='show_click' AND "createdAt">=${since} AND "createdAt"<${until} GROUP BY 1
        UNION ALL SELECT to_char("createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'America/Chicago','YYYY-MM-DD'),0,0,COUNT(*)::int,0,0
          FROM "SiteView" WHERE site IN ('live','blog') AND audience NOT IN ('operator','customer') AND "createdAt">=${since} AND "createdAt"<${until} GROUP BY 1
        UNION ALL SELECT to_char("createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'America/Chicago','YYYY-MM-DD'),0,0,0,COUNT(*)::int,0
          FROM "GrowthLead" WHERE offer='live' AND "createdAt">=${since} AND "createdAt"<${until} GROUP BY 1
        UNION ALL SELECT to_char("publishedAt" AT TIME ZONE 'UTC' AT TIME ZONE 'America/Chicago','YYYY-MM-DD'),0,0,0,0,COUNT(*)::int
          FROM "BuildStory" WHERE status='published' AND "publishedAt">=${since} AND "publishedAt"<${until} GROUP BY 1
      ) AS records GROUP BY day ORDER BY day`,
  ]);
  return { daily, since, until, controls, settings, activity, campaigns, clips, clicks, stories, impact, health, inquiries, visits,
    shows: shows.map(s => { const ledger = ledgerSchema.safeParse(s.ledger); return { ...s, result: ledger.success ? { ...contribution(ledger.data), settled: ledger.data.settled, grossSales: ledger.data.sales, ads: ledger.data.ads } : null }; }),
    limitations: "Activity lists show up to 500 records per source. Clicks do not establish purchases. Platform views and buyer/seller referral earnings are unavailable unless recorded with evidence. Impact is its own dated reporting window; approved commission is not a confirmed cash payout." };
}
