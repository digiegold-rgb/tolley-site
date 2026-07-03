#!/usr/bin/env node
/**
 * Growth pipeline stats for the weekly P&L digest (READ-ONLY).
 * Run from inside tolley-site: node --env-file=.env.local scripts/pnl-pipeline-stats.mjs
 * Prints a single JSON object to stdout; consumed by ~/growth-engine/weekly-pnl.mjs.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
try {
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [stageGroups, draftsPending, leadsAdded7d, totalLeads] = await Promise.all([
    prisma.growthLead.groupBy({ by: ['stage'], _count: { _all: true } }),
    prisma.growthTouch.count({ where: { status: 'draft' } }),
    prisma.growthLead.count({ where: { createdAt: { gte: weekAgo } } }),
    prisma.growthLead.count(),
  ]);

  const byStage = {};
  for (const g of stageGroups) byStage[g.stage] = g._count._all;

  process.stdout.write(JSON.stringify({ byStage, draftsPending, leadsAdded7d, totalLeads }) + '\n');
} finally {
  await prisma.$disconnect();
}
