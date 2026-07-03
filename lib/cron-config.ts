// Single source of truth for cron metadata used by the Systems / Pulse tabs.
// Each entry includes a heartbeat() that points at the table the cron writes
// to so the dashboard can detect "did this actually run?" without parsing
// Vercel logs.

import { prisma } from "@/lib/prisma";

export interface CronEntry {
  path: string;
  schedule: string;
  cadenceMin: number;
  description: string;
  heartbeat?: () => Promise<Date | null>;
}

const day = 1440;

export const CRONS: CronEntry[] = [
  { path: "/api/cron/sequence-process", schedule: "0 */1 * * *", cadenceMin: 60, description: "SMS sequence drip" },
  { path: "/api/cron/content-publish", schedule: "0 */1 * * *", cadenceMin: 60, description: "Auto-publish queued content" },
  { path: "/api/cron/dossier-cleanup", schedule: "0 */6 * * *", cadenceMin: 360, description: "Reap stale dossier jobs" },
  {
    path: "/api/cron/dossier-process",
    schedule: "*/2 * * * *",
    cadenceMin: 2,
    description: "Process queued dossier jobs",
    heartbeat: async () => (await prisma.dossierJob.findFirst({ orderBy: { updatedAt: "desc" }, select: { updatedAt: true } }))?.updatedAt ?? null,
  },
  { path: "/api/cron/dossier-synthesis-poll", schedule: "*/5 * * * *", cadenceMin: 5, description: "Poll OpenManus narrative jobs" },
  { path: "/api/cron/auto-responder-reset", schedule: "0 6 * * *", cadenceMin: day, description: "Daily auto-responder counter reset" },
  { path: "/api/cron/token-refresh", schedule: "0 */6 * * *", cadenceMin: 360, description: "Refresh OAuth tokens" },
  { path: "/api/cron/unclaimed-compliance", schedule: "0 7 * * *", cadenceMin: day, description: "Compliance sweep — unclaimed funds" },
  { path: "/api/cron/market-collect", schedule: "0 6,18 * * *", cadenceMin: 720, description: "Trading market data" },
  { path: "/api/cron/crypto-sync", schedule: "0 */4 * * *", cadenceMin: 240, description: "Crypto balance sync" },
  { path: "/api/cron/trading-agents", schedule: "0 21 * * 1-5", cadenceMin: day, description: "Trading agent decisions (M-F)" },
  {
    path: "/api/cron/pools-intelligence",
    schedule: "0 4 * * *",
    cadenceMin: day,
    description: "Pool pricing + insights",
    heartbeat: async () => (await prisma.poolInsight.findFirst({ orderBy: { createdAt: "desc" }, select: { createdAt: true } }))?.createdAt ?? null,
  },
  { path: "/api/cron/regrid-scan", schedule: "0 3 * * 1", cadenceMin: 7 * day, description: "Weekly Regrid parcel scan" },
  { path: "/api/cron/sms-reset", schedule: "0 0 1 * *", cadenceMin: 30 * day, description: "Monthly SMS quota reset" },
  { path: "/api/cron/shop-intelligence", schedule: "0 3 * * *", cadenceMin: day, description: "Shop intel scan" },
  {
    path: "/api/cron/retail-deal-scanner",
    schedule: "0 8 * * 1,3,5",
    cadenceMin: 2 * day,
    description: "Retail arbitrage deal scan (Home Depot/Lowe's/Walmart → eBay margin)",
    heartbeat: async () => (await prisma.retailDeal.findFirst({ orderBy: { createdAt: "desc" }, select: { createdAt: true } }))?.createdAt ?? null,
  },
  { path: "/api/cron/asin-backfill", schedule: "0 6 * * 0", cadenceMin: 7 * day, description: "Weekly ASIN backfill" },
  {
    path: "/api/cron/maps-pack-track",
    schedule: "0 7 * * 3",
    cadenceMin: 7 * day,
    description: "Weekly Maps Pack rank",
    heartbeat: async () => (await prisma.mapsPackRank.findFirst({ orderBy: { createdAt: "desc" }, select: { createdAt: true } }))?.createdAt ?? null,
  },
  {
    path: "/api/cron/ai-overview-check",
    schedule: "0 8 * * *",
    cadenceMin: day,
    description: "AI Overview citation check",
    heartbeat: async () => (await prisma.aiOverviewCheck.findFirst({ orderBy: { createdAt: "desc" }, select: { createdAt: true } }))?.createdAt ?? null,
  },
  {
    path: "/api/cron/probate-scan",
    schedule: "0 9 * * *",
    cadenceMin: day,
    description: "Probate lead scanner",
    heartbeat: async () => (await prisma.probateSignal.findFirst({ orderBy: { createdAt: "desc" }, select: { createdAt: true } }))?.createdAt ?? null,
  },
  {
    path: "/api/cron/deal-review-blast",
    schedule: "0 10 * * *",
    cadenceMin: day,
    description: "Deal-close → review SMS",
    heartbeat: async () => (await prisma.reviewRequest.findFirst({ where: { sourceType: "deal" }, orderBy: { createdAt: "desc" }, select: { createdAt: true } }))?.createdAt ?? null,
  },
  { path: "/api/cron/neighborhood-refresh", schedule: "0 11 * * 1", cadenceMin: 7 * day, description: "Refresh oldest neighborhood pages" },
  { path: "/api/cron/dispatch-match", schedule: "0 */1 * * *", cadenceMin: 60, description: "Dispatch order → driver match" },
  { path: "/api/cron/dispatch-payouts", schedule: "0 6 * * *", cadenceMin: day, description: "Driver payouts" },
  { path: "/api/cron/dispatch-stale", schedule: "0 */2 * * *", cadenceMin: 120, description: "Reap stale dispatch orders" },
  { path: "/api/cron/dispatch-compliance", schedule: "0 7 * * *", cadenceMin: day, description: "Dispatch compliance sweep" },
  { path: "/api/cron/trading-sync", schedule: "0 */4 * * *", cadenceMin: 240, description: "Trading account sync" },
  { path: "/api/cron/trading-sim-sync", schedule: "*/5 * * * *", cadenceMin: 5, description: "Trading sim ticker" },
  { path: "/api/cron/fb-sync", schedule: "0 */6 * * *", cadenceMin: 360, description: "FB analytics sync" },
  {
    path: "/api/cron/mls-sync",
    schedule: "0 */4 * * *",
    cadenceMin: 240,
    description: "MLS Grid listing sync",
    heartbeat: async () => (await prisma.syncLog.findFirst({ where: { source: { contains: "mls" } }, orderBy: { createdAt: "desc" }, select: { createdAt: true } }))?.createdAt ?? null,
  },
  { path: "/api/cron/mls-social", schedule: "30 */6 * * *", cadenceMin: 360, description: "MLS social posts" },
  {
    path: "/api/cron/wd-reminders",
    schedule: "0 16 * * *",
    cadenceMin: day,
    description: "W/D renew-soon SMS drafts",
    heartbeat: async () => (await prisma.wdMessage.findFirst({ where: { kind: "reminder" }, orderBy: { createdAt: "desc" }, select: { createdAt: true } }))?.createdAt ?? null,
  },
  {
    path: "/api/cron/wd-dunning",
    schedule: "0 17 * * *",
    cadenceMin: day,
    description: "W/D failed-payment dunning ladder",
    heartbeat: async () => (await prisma.wdMessage.findFirst({ where: { kind: "dunning" }, orderBy: { createdAt: "desc" }, select: { createdAt: true } }))?.createdAt ?? null,
  },
  { path: "/api/cron/food-trial-ending", schedule: "0 14 * * *", cadenceMin: day, description: "Food trial-ending email" },
  { path: "/api/cron/food-expiring", schedule: "0 15 * * *", cadenceMin: day, description: "Food expiring-ingredient sweep" },
  { path: "/api/cron/food-reengagement", schedule: "0 16 * * *", cadenceMin: day, description: "Food reengagement email" },
  {
    path: "/api/cron/vater-rss-poll",
    schedule: "*/15 * * * *",
    cadenceMin: 15,
    description: "Vater RSS feed poll",
    heartbeat: async () => (await prisma.vaterRssItem.findFirst({ orderBy: { discoveredAt: "desc" }, select: { discoveredAt: true } }))?.discoveredAt ?? null,
  },
  { path: "/api/cron/budget-plaid-sync", schedule: "45 12 * * *", cadenceMin: day, description: "Plaid transactions sync" },
  { path: "/api/cron/budget-recurring-rollup", schedule: "0 11 * * *", cadenceMin: day, description: "Budget recurring rollup" },
  { path: "/api/cron/budget-digest", schedule: "0 2 * * *", cadenceMin: day, description: "Daily budget digest" },
  { path: "/api/cron/shop/enrich-pending-descriptions", schedule: "*/30 * * * *", cadenceMin: 30, description: "Shop AI description enrichment" },
  { path: "/api/cron/treasure-haul-daily", schedule: "0 13 * * *", cadenceMin: day, description: "Treasure Haul FB post" },
  { path: "/api/cron/fb-token-health", schedule: "0 14 * * 1", cadenceMin: 7 * day, description: "Weekly FB token expiry check" },
];
