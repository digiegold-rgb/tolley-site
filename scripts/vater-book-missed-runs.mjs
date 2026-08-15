#!/usr/bin/env node
/**
 * vater-book-missed-runs.mjs — book the renders a card silently dropped.
 *
 * `costJson.byJob` is keyed by job id, and vater.py re-drives a stuck pipeline
 * job under the SAME id. Every re-run overwrites `result.costs.totalUsd`, so
 * the card ends up holding the LAST run and the earlier ones — money that was
 * really spent — vanish. #21 is the loud case (3 renders, card showed 1), but
 * the audit found the same shape on #5, #12, #17, #18, #19, #20.
 *
 * ledger.jsonl is the durable record: the pipeline appends one
 * "pipeline job <id> — ..." row per completed run, so a job with three of them
 * ran three times. Aggregate check over 8/6-8/13: counting every emission
 * gives $98.12 against $102.63 of billed vater-* Modal spend; counting only
 * the last run gives $87.83. Corroborated per-video by #12 (Jared's record:
 * "rendered twice ≈$1.17", card had $0.58) and by #20/#5, whose re-runs
 * changed the call count (131->151, 15->7) and so cannot be re-measurements.
 *
 * The superseded runs are booked as an itemised byStage.reconciliation entry,
 * which the reconciler now treats as durable, and totalUsd is written with it
 * (the entry alone no longer moves a total — see vater-cost-reconcile.mjs).
 * byJob is left alone: it holds the last run, reconciliation holds the rest,
 * and the two sum to the ledger's view of the project. Idempotent — it
 * re-derives the target every run and skips a card that already covers it,
 * so a human booking (#2, #4, #7, #21) is never overwritten.
 *
 *   node scripts/vater-book-missed-runs.mjs --dry-run
 *   node scripts/vater-book-missed-runs.mjs
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const SITE_ROOT = '/home/jelly/tolley-site';
const require = createRequire(`${SITE_ROOT}/package.json`);
const { PrismaClient } = require('@prisma/client');

const LEDGER = '/home/jelly/vater-studio/ledger.jsonl';
const OWNER = 'cmnzgxvoy0000l4r6fyuatyku'; // Trey
const STAGE = 'missedRuns';

const DRY = process.argv.includes('--dry-run');
const r2 = (n) => Math.round(n * 100) / 100;
const r4 = (n) => Math.round(n * 10000) / 10000;

/** Per-run emissions from the ledger: project -> job -> ts -> usd. Only
 *  machine-written "pipeline job" rows count; manual summary/true-up rows
 *  RESTATE spend rather than add to it (#7's two summary rows are why its
 *  raw ledger subtotal reads $26 against a true $14.13). */
function emissionsByProject() {
  const out = new Map();
  for (const line of readFileSync(LEDGER, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    let e;
    try {
      e = JSON.parse(line);
    } catch {
      continue;
    }
    if (!e.projectId || !e.jobId) continue;
    if (!String(e.note ?? '').startsWith('pipeline job ')) continue;
    const usd = Number(e.usd) || 0;
    if (!usd) continue;
    const jobs = out.get(e.projectId) ?? new Map();
    const runs = jobs.get(e.jobId) ?? new Map();
    runs.set(e.ts, r4((runs.get(e.ts) ?? 0) + usd)); // one emission = one ts
    jobs.set(e.jobId, runs);
    out.set(e.projectId, jobs);
  }
  return out;
}

const prisma = new PrismaClient();
const projects = await prisma.youTubeProject.findMany({
  where: { userId: OWNER, projectType: 'youtube' },
  select: { id: true, sourceTitle: true, costJson: true },
  orderBy: { createdAt: 'asc' },
});

const ledger = emissionsByProject();
let booked = 0;

for (const p of projects) {
  const jobs = ledger.get(p.id);
  if (!jobs) continue;

  const cost = p.costJson ?? {};
  const card = Number(cost.totalUsd ?? 0);
  const captureUsd = Object.values(cost.byJob ?? {}).reduce((a, b) => a + (Number(b) || 0), 0);
  const label = (p.sourceTitle || p.id).slice(0, 38);

  // Everything but the newest emission of each job is a run the card dropped —
  // unless byJob is empty (the pipeline wrote the card directly, so it is not
  // holding any particular run), in which case every run is unaccounted for.
  const runsAll = {};
  const superseded = {};
  let allRunsUsd = 0;
  for (const [jobId, runs] of jobs) {
    const byTs = [...runs.entries()].sort(([a], [b]) => a.localeCompare(b));
    allRunsUsd += byTs.reduce((a, [, usd]) => a + usd, 0);
    byTs.forEach(([ts, usd], i) => {
      const key = `${jobId.slice(0, 8)}_run${i + 1}_${ts.slice(0, 10)}`;
      runsAll[key] = usd;
      if (i < byTs.length - 1) superseded[key] = usd;
    });
  }
  const detail = captureUsd > 0 ? superseded : runsAll;
  const missedUsd = r2(Object.values(detail).reduce((a, b) => a + b, 0));
  if (!missedUsd) continue;

  const target = r2(allRunsUsd);

  // A human booking (billing true-up) already covers the missed runs.
  if (card >= target - 0.005) {
    console.log(`   skip  ${label}  card $${card.toFixed(2)} >= ledger $${target.toFixed(2)}`);
    continue;
  }

  const byStage = { ...(cost.byStage ?? {}) };
  byStage.reconciliation = {
    ...(byStage.reconciliation ?? {}),
    [STAGE]: missedUsd,
    missedRunsNote:
      `${Object.keys(detail).length} run(s) of a re-driven job that the card ` +
      `never counted, from ledger.jsonl pipeline-run rows` +
      (captureUsd > 0 ? '; byJob holds the last run only' : '; byJob is empty'),
    missedRunsDetail: detail,
  };
  // usd is the roll-up summary.ts renders; itemised amounts are the source.
  byStage.reconciliation.usd = r2(
    Object.entries(byStage.reconciliation)
      .filter(([k, v]) => k !== 'usd' && k !== 'calls' && typeof v === 'number')
      .reduce((a, [, v]) => a + v, 0),
  );

  console.log(`${DRY ? '[dry] ' : ''}   BOOK  ${label}  $${card.toFixed(2)} -> $${target.toFixed(2)}` +
    `  (+$${missedUsd.toFixed(2)} missed: ${Object.entries(detail).map(([k, v]) => `${k} $${v.toFixed(2)}`).join(', ')})`);
  booked++;
  if (DRY) continue;

  await prisma.youTubeProject.update({
    where: { id: p.id },
    data: { costJson: { ...cost, byStage, totalUsd: target } },
  });
}

console.log(booked ? `\n${booked} card(s) ${DRY ? 'would be ' : ''}re-booked.` : '\nNothing to book.');
await prisma.$disconnect();
