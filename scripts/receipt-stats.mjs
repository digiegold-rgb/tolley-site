#!/usr/bin/env node
/**
 * scripts/receipt-stats.mjs — Prisma companion for the daily "While You
 * Slept" receipt (growth-engine/daily-receipt.mjs). Pattern matches
 * pnl-pipeline-stats.mjs: runs inside tolley-site for @prisma/client,
 * prints ONE JSON object on the last line.
 *
 *   node --env-file=.env.local scripts/receipt-stats.mjs
 *
 * Read-only. Window = last 24 hours.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

const [
  goClickEvents,
  newLeads,
  digestNew,
  digestCanceled,
  digestActive,
  amazonRows,
  cleanoutQuotes,
  hqDraftTouches,
  hqApprovedUnsent,
] = await Promise.all([
  // Affiliate /go redirects by source. isBot lives inside the `meta` JSON
  // blob (not a queryable column — see lib/shop/click-classifier.ts), so we
  // pull rows and filter in JS rather than groupBy, matching the pattern in
  // app/api/shop/affiliate/click-quality/route.ts. Without this, bot traffic
  // (100% of amazon_click volume as of 2026-07) drowns out real clicks.
  prisma.siteEvent.findMany({
    where: { event: "go_redirect", createdAt: { gte: since } },
    select: { label: true, meta: true },
  }).catch(() => []),
  prisma.growthLead.count({ where: { createdAt: { gte: since } } }),
  prisma.digestSubscriber?.count({
    where: { status: "active", updatedAt: { gte: since }, joinedAt: { gte: since } },
  }).catch(() => 0) ?? 0,
  prisma.digestSubscriber?.count({
    where: { status: { in: ["canceled", "paused"] }, updatedAt: { gte: since } },
  }).catch(() => 0) ?? 0,
  prisma.digestSubscriber?.count({ where: { status: { in: ["active", "trial"] } } }).catch(() => 0) ?? 0,
  prisma.revenueEntry.aggregate({
    where: { business: "Amazon Associates", importedAt: { gte: since } },
    _sum: { profit: true },
    _count: true,
  }).catch(() => ({ _sum: { profit: 0 }, _count: 0 })),
  prisma.growthLead.count({
    where: { offer: "cleanout", source: "cleanouts-page", createdAt: { gte: since } },
  }),
  // Approvals-waiting: outbound email drafts in /hq that Cordless could
  // approve tonight, and approved-but-unsent (stuck in the sender queue).
  prisma.growthTouch.count({
    where: { status: "draft", channel: "email", direction: "out" },
  }).catch(() => 0),
  prisma.growthTouch.count({
    where: { status: "approved", channel: "email", direction: "out" },
  }).catch(() => 0),
]);

const goClicks = {};
for (const e of goClickEvents) {
  if (e.meta?.isBot) continue; // drop bot/datacenter traffic
  const label = e.label ?? "unknown";
  goClicks[label] = (goClicks[label] ?? 0) + 1;
}

console.log(
  JSON.stringify({
    goClicks,
    goClicksTotal: Object.values(goClicks).reduce((s, n) => s + n, 0),
    goClicksBotFiltered: goClickEvents.length - Object.values(goClicks).reduce((s, n) => s + n, 0),
    newLeads,
    digest: { new: digestNew, canceled: digestCanceled, active: digestActive },
    amazonImported: { profit: amazonRows._sum.profit ?? 0, rows: amazonRows._count },
    cleanoutQuotes,
    hqApprovals: { drafts: hqDraftTouches, approvedUnsent: hqApprovedUnsent },
  }),
);

await prisma.$disconnect();
