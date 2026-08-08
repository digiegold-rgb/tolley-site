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
  repriceEvents,
  amazonClickEvents,
  mustComplete,
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
  // Nightly FB Marketplace repricer (fb-draft-worker) — what dropped
  // overnight. Table may not exist on older schemas; degrade to [].
  prisma.repriceEvent.findMany({
    where: { runAt: { gte: since } },
    orderBy: { runAt: "desc" },
    take: 300,
  }).catch(() => []),
  // Outbound Amazon clicks (direct + search fallback). Same meta.isBot
  // filtering story as go_redirect above.
  prisma.siteEvent.findMany({
    where: {
      event: { in: ["amazon_click", "amazon_search_click"] },
      createdAt: { gte: since },
    },
    select: { label: true, meta: true },
  }).catch(() => []),
  // Money Loop: the top open Must Complete items, red first — the receipt
  // surfaces at most 3 as "your 15 minutes".
  prisma.mustCompleteItem.findMany({
    where: { status: "open" },
    orderBy: [{ sortOrder: "asc" }],
    select: { title: true, priority: true, sortOrder: true },
  }).catch(() => []),
]);

const goClicks = {};
for (const e of goClickEvents) {
  if (e.meta?.isBot) continue; // drop bot/datacenter traffic
  const label = e.label ?? "unknown";
  goClicks[label] = (goClicks[label] ?? 0) + 1;
}

let amazonClicksReal = 0;
let amazonClicksBot = 0;
for (const e of amazonClickEvents) {
  if (e.meta?.isBot) amazonClicksBot += 1;
  else amazonClicksReal += 1;
}

const PRIORITY_RANK = { red: 0, yellow: 1, green: 2 };
const fifteenMinutes = mustComplete
  .sort(
    (a, b) =>
      (PRIORITY_RANK[a.priority] ?? 3) - (PRIORITY_RANK[b.priority] ?? 3) ||
      a.sortOrder - b.sortOrder,
  )
  .slice(0, 3)
  .map((i) => ({ title: i.title, priority: i.priority }));

console.log(
  JSON.stringify({
    goClicks,
    goClicksTotal: Object.values(goClicks).reduce((s, n) => s + n, 0),
    goClicksBotFiltered: goClickEvents.length - Object.values(goClicks).reduce((s, n) => s + n, 0),
    amazonClicks: { real: amazonClicksReal, bot: amazonClicksBot },
    fifteenMinutes,
    mustCompleteOpen: {
      red: mustComplete.filter((i) => i.priority === "red").length,
      total: mustComplete.length,
    },
    newLeads,
    digest: { new: digestNew, canceled: digestCanceled, active: digestActive },
    amazonImported: { profit: amazonRows._sum.profit ?? 0, rows: amazonRows._count },
    cleanoutQuotes,
    hqApprovals: { drafts: hqDraftTouches, approvedUnsent: hqApprovedUnsent },
    reprice: (() => {
      const dropped = repriceEvents.filter((e) => e.status === "dropped");
      return {
        dropped: dropped.length,
        gone: repriceEvents.filter((e) => e.status === "gone").length,
        failed: repriceEvents.filter((e) => e.status === "failed").length,
        totalDiscount: Math.round(dropped.reduce((s2, e) => s2 + (e.fromPrice - e.toPrice), 0)),
        samples: dropped.slice(0, 3).map((e) => ({
          title: e.title,
          from: Math.round(e.fromPrice),
          to: Math.round(e.toPrice),
        })),
      };
    })(),
  }),
);

await prisma.$disconnect();
