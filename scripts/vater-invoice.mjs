#!/usr/bin/env node
/**
 * vater-invoice.mjs — Vater render invoice.
 *
 * Two line items, deliberately separate:
 *   "Compute (at cost)"  — per-model GPU/API spend, passed through unchanged
 *                          from each project's reconciled costJson.
 *   "Render Operations"  — finished_video_minutes x OPS_RATE (the margin).
 *
 * OPS_RATE lives in ~/vater-studio/VATER-SETTINGS.env as
 * VATER_OPS_RATE_PER_MIN (dollars per finished minute) so the rate changes
 * without touching billing logic. Defaults to 0.35/min if unset.
 *
 *   node scripts/vater-invoice.mjs                       # invoice, all ready videos
 *   node scripts/vater-invoice.mjs --summary             # per-video breakdown
 *   node scripts/vater-invoice.mjs --since 2026-08-01    # period filter
 *   node scripts/vater-invoice.mjs --user <userId>
 *   node scripts/vater-invoice.mjs --json
 */
import { readFileSync } from 'node:fs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const SETTINGS = '/home/jelly/vater-studio/VATER-SETTINGS.env';
const DEFAULT_OPS_RATE = 0.35; // 35c per rendered minute; config still wins

const argv = process.argv.slice(2);
const arg = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : undefined; };
const SUMMARY = argv.includes('--summary');
const AS_JSON = argv.includes('--json');
const SINCE = arg('--since');
const USER = arg('--user');
const RATE_OVERRIDE = arg('--ops-rate');

function opsRate() {
  if (RATE_OVERRIDE !== undefined) return Number(RATE_OVERRIDE);
  try {
    const line = readFileSync(SETTINGS, 'utf8').split('\n')
      .find((l) => l.trim().startsWith('VATER_OPS_RATE_PER_MIN='));
    if (line) {
      const v = Number(line.split('=')[1].trim().replace(/["']/g, ''));
      if (Number.isFinite(v) && v >= 0) return v;
    }
  } catch { /* fall through to default */ }
  return DEFAULT_OPS_RATE;
}

const RATE = opsRate();
const r2 = (n) => Math.round(n * 100) / 100;
const usd = (n) => `$${n.toFixed(2)}`;

const where = { status: 'ready', finalVideoUrl: { not: null } };
if (USER) where.userId = USER;
if (SINCE) where.completedAt = { gte: new Date(SINCE) };

const projects = await prisma.youTubeProject.findMany({
  where,
  select: {
    id: true, publishTitle: true, sourceTitle: true,
    audioDuration: true, costJson: true, completedAt: true,
  },
  orderBy: { completedAt: 'asc' },
});

const lines = projects.map((p) => {
  const durationSeconds = Number(p.audioDuration ?? 0);
  const minutes = Math.max(0, durationSeconds) / 60;
  // Compute is passed through EXACTLY as reconciled — never recalculated here.
  const computeUsd = r2(Number(p.costJson?.totalUsd ?? 0));
  const opsUsd = r2(minutes * RATE);
  const totalUsd = r2(computeUsd + opsUsd);
  return {
    projectId: p.id,
    title: (p.publishTitle || p.sourceTitle || p.id).slice(0, 44),
    completedAt: p.completedAt,
    durationSeconds: Math.round(durationSeconds),
    minutes: r2(minutes),
    computeUsd,
    opsUsd,
    totalUsd,
    effectiveUsdPerMinute: minutes > 0 ? r2(totalUsd / minutes) : 0,
  };
}).filter((l) => l.minutes > 0 || l.computeUsd > 0);

const computeSubtotal = r2(lines.reduce((a, l) => a + l.computeUsd, 0));
const opsSubtotal = r2(lines.reduce((a, l) => a + l.opsUsd, 0));
const total = r2(computeSubtotal + opsSubtotal);
const totalMinutes = r2(lines.reduce((a, l) => a + l.minutes, 0));

if (AS_JSON) {
  console.log(JSON.stringify({
    opsRatePerMinute: RATE,
    lineItems: [
      { label: 'Compute (at cost)', subtotalUsd: computeSubtotal },
      { label: 'Render Operations', subtotalUsd: opsSubtotal, minutes: totalMinutes, ratePerMinute: RATE },
    ],
    totalUsd: total,
    videos: lines,
  }, null, 2));
  await prisma.$disconnect();
  process.exit(0);
}

const mmss = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

if (SUMMARY) {
  console.log(`\nPER-VIDEO SUMMARY   (ops rate ${usd(RATE)}/finished min)\n`);
  console.log(
    'VIDEO'.padEnd(46) + 'DURATION'.padStart(9) + 'COMPUTE'.padStart(10) +
    'OPS FEE'.padStart(10) + 'TOTAL'.padStart(10) + '$/MIN'.padStart(9));
  console.log('-'.repeat(94));
  for (const l of lines) {
    console.log(
      l.title.padEnd(46) +
      mmss(l.durationSeconds).padStart(9) +
      usd(l.computeUsd).padStart(10) +
      usd(l.opsUsd).padStart(10) +
      usd(l.totalUsd).padStart(10) +
      usd(l.effectiveUsdPerMinute).padStart(9));
  }
  console.log('-'.repeat(94));
  console.log(
    `${lines.length} video(s)`.padEnd(46) +
    mmss(Math.round(totalMinutes * 60)).padStart(9) +
    usd(computeSubtotal).padStart(10) +
    usd(opsSubtotal).padStart(10) +
    usd(total).padStart(10) +
    usd(totalMinutes > 0 ? r2(total / totalMinutes) : 0).padStart(9));
}

console.log(`\nINVOICE${SINCE ? ` — since ${SINCE}` : ''}${USER ? ` — user ${USER}` : ''}`);
console.log('='.repeat(60));
console.log(
  'Compute (at cost)'.padEnd(44) + usd(computeSubtotal).padStart(16));
console.log(
  `Render Operations  (${totalMinutes.toFixed(2)} min x ${usd(RATE)}/min)`.padEnd(44) +
  usd(opsSubtotal).padStart(16));
console.log('-'.repeat(60));
console.log('TOTAL'.padEnd(44) + usd(total).padStart(16));
console.log('='.repeat(60));
console.log(`${lines.length} finished video(s), ${totalMinutes.toFixed(2)} minutes delivered\n`);

await prisma.$disconnect();
