import { prisma } from "@/lib/prisma";
import { reportWindow } from "./core";
import { contribution, ledgerSchema } from "@/lib/live/core";
export async function growthReport(period: string) {
  const { since, until } = reportWindow(period);
  const range = { gte: since, lt: until };
  const [controls, settings, activity, campaigns, clips, shows, clicks, stories, impact, health, inquiries, visits] = await Promise.all([
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
  ]);
  return { since, until, controls, settings, activity, campaigns, clips, clicks, stories, impact, health, inquiries, visits,
    shows: shows.map(s => { const ledger = ledgerSchema.safeParse(s.ledger); return { ...s, result: ledger.success ? { ...contribution(ledger.data), settled: ledger.data.settled, grossSales: ledger.data.sales, ads: ledger.data.ads } : null }; }),
    limitations: "Activity lists show up to 500 records per source. Clicks do not establish purchases. Platform views and buyer/seller referral earnings are unavailable unless recorded with evidence. Impact is its own dated reporting window; approved commission is not a confirmed cash payout." };
}
