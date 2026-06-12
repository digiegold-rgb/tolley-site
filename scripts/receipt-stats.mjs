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
  goClicks,
  newLeads,
  digestNew,
  digestCanceled,
  digestActive,
  amazonRows,
  cleanoutQuotes,
] = await Promise.all([
  // Affiliate /go redirects by source
  prisma.siteEvent.groupBy({
    by: ["label"],
    where: { event: "go_redirect", createdAt: { gte: since } },
    _count: true,
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
]);

console.log(
  JSON.stringify({
    goClicks: Object.fromEntries(goClicks.map((g) => [g.label ?? "unknown", g._count])),
    goClicksTotal: goClicks.reduce((s, g) => s + g._count, 0),
    newLeads,
    digest: { new: digestNew, canceled: digestCanceled, active: digestActive },
    amazonImported: { profit: amazonRows._sum.profit ?? 0, rows: amazonRows._count },
    cleanoutQuotes,
  }),
);

await prisma.$disconnect();
