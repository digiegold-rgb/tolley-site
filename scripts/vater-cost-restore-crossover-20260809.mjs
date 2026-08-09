#!/usr/bin/env node
/**
 * One-off repair, 2026-08-09: the crossover video's main run-creation render
 * job(s) aged out of vater_jobs.json (40-job prune window) before
 * vater-cost-reconcile.mjs learned to merge instead of rebuild, so the cron
 * rewrote its cost $14.13 -> $5.97. The $8.16 'render' delta between the
 * verified $14.13 all-in (31 jobs, reconciled 8/8) and what the pruned file
 * could still see is restored here as a durable byJob entry, per the
 * hand-edit rule in vater-cost-truth: hand edits must land in byJob or a
 * later reconcile re-derives without them.
 */
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
const ID = 'cmsks8hae0001l4wcze2zf4ka';
const p = await prisma.youTubeProject.findUnique({ where: { id: ID }, select: { costJson: true } });
const c = p?.costJson ?? {};
const byJob = { ...(c.byJob ?? {}) };
if (byJob['restored-render-20260809']) {
  console.log('already restored, nothing to do');
} else {
  byJob['restored-render-20260809'] = 8.16;
  const byJobStage = { ...(c.byJobStage ?? {}), 'restored-render-20260809': 'render' };
  await prisma.youTubeProject.update({ where: { id: ID }, data: { costJson: { ...c, byJob, byJobStage } } });
  console.log('restored $8.16 render entry; byJob now has', Object.keys(byJob).length, 'jobs');
}
await prisma.$disconnect();
