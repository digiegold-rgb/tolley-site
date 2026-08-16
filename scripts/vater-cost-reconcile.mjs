#!/usr/bin/env node
/**
 * vater-cost-reconcile.mjs — make a Vater project's costJson the TRUTH.
 *
 * Why this exists: only the main run-creation path ever wrote cost back to the
 * project. Every side path spent real money that never reached the Library
 * card — single-scene animates, "animate all" from the editor, revise +
 * recompose passes, and any script that talks to the DGX directly. The
 * crossover video showed $7.48 on the card while $14.13 had actually been
 * spent across 31 jobs. Jared should never have to ask for the total.
 *
 * This does not trust anyone to remember: it re-derives the total from
 * vater_jobs.json (the DGX's own record of every paid call) every time it
 * runs, so it is idempotent and self-healing. costJson.byJob lists every
 * jobId counted, which is also what stops the site's additive mergeVideoCost
 * from double-counting on a later poll.
 *
 * ⚠️ vater_jobs.json is NOT an append-only ledger — vater.py prunes it to the
 * newest 40 finished jobs (perf fix for the 15MB re-serialize stall). A job
 * that ages out of the file must NOT age out of the project's cost: byJob in
 * the DB is the durable record, so we MERGE file-derived amounts over the
 * existing byJob instead of rebuilding it. File wins for jobs it still has
 * (handles corrections); jobs it no longer has keep their recorded amount,
 * with byJobStage remembering which stage each belonged to. A total may only
 * ever go down when the file corrects a still-visible job — never because
 * history rotated away. (First regression 8/9: crossover $14.13 -> $5.97.)
 *
 * ⚠️ Job captures are not the whole bill. Some spend never appears in
 * vater_jobs.json at all — Modal charges for work a job under-reported, repair
 * passes driven straight from a script, provider invoices that land days later.
 * That spend is booked by hand into byStage.reconciliation, and this script
 * must treat the booking as DURABLE INPUT, never as something to recompute.
 * (Regression 8/13, twice in one day: #21 $22.90 -> $1.87 and the
 * reconciliation entry erased, because byStage was rebuilt from captures.)
 *
 * A reconciled project is therefore anchored on its BOOKED total, and this
 * script only applies what has changed in the captures since:
 *
 *     total = bookedTotal + (captureSum now - captureSum when booked)
 *
 * Anchoring is what makes the two reconciliation dialects in the data safe to
 * handle with one rule. #1-#4 annotate a true-up that is already inside their
 * booked total ("real all-in per Modal billing report"); #21 books a true-up
 * on top of a capture that saw one render out of three. Adding the entry's
 * dollars would double-count the first kind; ignoring it loses the second.
 * The human's total already resolves it — so never re-derive that number, and
 * when booking one, write totalUsd too (see scripts/tmp-book-21-true.ts).
 *
 *   node scripts/vater-cost-reconcile.mjs                 # every project
 *   node scripts/vater-cost-reconcile.mjs --project <id>  # one project
 *   node scripts/vater-cost-reconcile.mjs --dry-run
 */
import { readFileSync } from 'node:fs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const JOBS_PATH = '/home/jelly/content-autopilot/vater_jobs.json';

const argv = process.argv.slice(2);
const arg = (f) => {
  const i = argv.indexOf(f);
  return i >= 0 ? argv[i + 1] : undefined;
};
const ONLY = arg('--project');
const DRY = argv.includes('--dry-run');

function loadJobs() {
  const raw = JSON.parse(readFileSync(JOBS_PATH, 'utf8'));
  const jobs = raw.jobs ?? raw;
  return Array.isArray(jobs) ? jobs : Object.values(jobs);
}

/** Cost a single job actually incurred, or 0. `costs.totalUsd` is preferred:
 *  it already carries the Modal cold-start overhead multiplier, while the
 *  bare `cost` field is the backend's raw per-clip estimate. */
function jobCost(job) {
  const r = job?.result ?? {};
  const c = r?.costs?.totalUsd ?? r?.cost;
  return typeof c === 'number' && c > 0 ? c : 0;
}

function stageOf(job) {
  const model = String(job?.result?.model ?? '').toLowerCase();
  if (model.includes('kling') || model.includes('luma')) return 'fal_anim';
  switch (job?.kind) {
    case 'run-creation': return 'render';
    case 'animate-scene':
    case 'animate-all-scenes': return 'reanimate';
    case 'regen-scene': return 'regen';
    case 'tts': return 'tts';
    case 'compose-video': return 'compose';
    default: return job?.kind || 'other';
  }
}

/** Stages that are booked by hand and have no job behind them. Carried over
 *  from the stored costJson untouched; never derived, never dropped. */
const MANUAL_STAGES = new Set(['reconciliation']);

/** Dollars a manual stage entry represents — reported, never used to move a
 *  total (the booked totalUsd owns that). Two shapes are in the wild: a plain
 *  `{usd}` like the capture stages, and an itemised booking such as
 *  `{originalRenderTrueUp: 5.53, repair21: 11.40, note: "..."}`. Itemised
 *  amounts win when present; `usd` is written back as the derived roll-up for
 *  lib/vater/billing/summary.ts, which only knows the `{usd}` shape. */
function manualStageUsd(entry) {
  if (!entry || typeof entry !== 'object') return 0;
  let items = 0;
  for (const [k, v] of Object.entries(entry)) {
    if (k === 'usd' || k === 'calls') continue;
    if (typeof v === 'number' && Number.isFinite(v)) items += v;
  }
  if (items > 0) return Number(items.toFixed(4));
  const flat = Number(entry.usd);
  return Number.isFinite(flat) && flat > 0 ? Number(flat.toFixed(4)) : 0;
}

const jobs = loadJobs();

/** A job belongs to a project if it says so, or if it targets that project's
 *  pipeline job (side-path jobs carry pipeline_job_id, not projectId). */
function jobsForProject(projectId, pipelineJobId) {
  return jobs.filter((j) => {
    if (j?.projectId === projectId) return true;
    if (!pipelineJobId) return false;
    if (j?.id === pipelineJobId) return true;
    const kw = j?._kwargs ?? {};
    if (kw.pipeline_job_id === pipelineJobId || kw.job_id === pipelineJobId) return true;
    // Fall back to the result blob — animate-all writes per-scene URLs that
    // embed the pipeline job id and carries no projectId of its own.
    return JSON.stringify(j?.result ?? {}).slice(0, 2000).includes(pipelineJobId);
  });
}

const projects = await prisma.youTubeProject.findMany({
  where: ONLY ? { id: ONLY } : { autopilotJobId: { not: null } },
  select: { id: true, autopilotJobId: true, costJson: true, sourceTitle: true, publishTitle: true },
});

let changed = 0;
/** Projects whose costJson moved this run — their credit debits need a true-up. */
const adjusted = [];
for (const p of projects) {
  const mine = jobsForProject(p.id, p.autopilotJobId);
  const fileByJob = {};
  const fileStage = {};
  for (const j of mine) {
    const c = jobCost(j);
    if (!c) continue;
    fileByJob[j.id] = Number(c.toFixed(4));
    fileStage[j.id] = stageOf(j);
  }

  const prevByJob = p.costJson?.byJob && typeof p.costJson.byJob === 'object' ? p.costJson.byJob : {};
  const prevStage = p.costJson?.byJobStage && typeof p.costJson.byJobStage === 'object' ? p.costJson.byJobStage : {};
  const prevByStage = p.costJson?.byStage && typeof p.costJson.byStage === 'object' ? p.costJson.byStage : {};

  const byJob = {};
  const byJobStage = {};
  const byStage = {};
  for (const [jid, usdRaw] of Object.entries({ ...prevByJob, ...fileByJob })) {
    const usd = Number(usdRaw);
    if (!(usd > 0)) continue;
    byJob[jid] = Number(usd.toFixed(4));
    const s = fileStage[jid] ?? prevStage[jid] ?? 'prior';
    byJobStage[jid] = s;
    byStage[s] ??= { usd: 0, calls: 0 };
    byStage[s].usd = Number((byStage[s].usd + byJob[jid]).toFixed(4));
    byStage[s].calls += 1;
  }
  // Hand-booked stages ride along untouched.
  let booked = false;
  let restage = false;
  for (const [key, entry] of Object.entries(prevByStage)) {
    if (!MANUAL_STAGES.has(key)) continue;
    const usd = manualStageUsd(entry);
    byStage[key] = { ...entry, usd };
    booked = true;
    // An itemised booking arrives without the roll-up summary.ts reads.
    if (Math.abs(Number(entry.usd ?? 0) - usd) >= 0.005) restage = true;
  }

  const captureUsd = Object.values(byJob).reduce((a, b) => a + b, 0);
  const prevCaptureUsd = Object.values(prevByJob).reduce((a, b) => a + (Number(b) || 0), 0);
  const prev = Number(p.costJson?.totalUsd ?? 0);
  // Un-booked projects: captures are the whole story. Booked ones: hold the
  // human's number and move it only by the change in captures.
  const total = booked
    ? Number((prev + captureUsd - prevCaptureUsd).toFixed(2))
    : Number(captureUsd.toFixed(2));
  if (!total) continue;

  if (Math.abs(prev - total) < 0.005 && !restage) continue;

  const label = (p.publishTitle || p.sourceTitle || p.id).slice(0, 40);
  console.log(
    `${DRY ? '[dry] ' : ''}${p.id}  ${label}\n` +
    `   $${prev.toFixed(2)} -> $${total.toFixed(2)}  (${Object.keys(byJob).length} jobs: ` +
    Object.entries(byStage).map(([k, v]) => `${k} $${v.usd.toFixed(2)}`).join(', ') + ')',
  );
  changed++;
  if (DRY) continue;

  await prisma.youTubeProject.update({
    where: { id: p.id },
    data: {
      costJson: {
        ...(p.costJson ?? {}),
        totalUsd: total,
        byStage,
        byJob,
        byJobStage,
        estimated: true,
        reconciledAt: new Date().toISOString(),
        reconciledBy: 'vater-cost-reconcile',
      },
    },
  });

  // ── Credit-ledger true-up ────────────────────────────────────────────────
  // The compute number just moved. If this project has already been debited
  // against the customer's prepaid balance, the debit is now wrong, so write
  // a signed 'adjust' row bringing the total charge back in line.
  //
  // Never edits the original debit: a ledger that rewrites its own history
  // cannot be audited, and the customer should SEE the correction rather than
  // find a number that changed. adjustProjectDebit() is a no-op under $0.05,
  // is idempotent per revision, and re-applies the repair cap so a true-up
  // can't push a charge past 3x the project's estimate.
  adjusted.push(p.id);
}

// Ledger adjusts run after the cost writes so a crash mid-loop leaves costs
// correct and the ledger merely stale — the next run picks it back up.
//
// Handed off to a TypeScript sibling rather than reimplemented here: the
// billing line (compute + finished-minutes x ops rate) and the repair cap
// live in lib/vater/billing/, and a second copy of that arithmetic in this
// file is exactly the fork that put a growing "Other" row on Trey's bill.
// Non-fatal: a failed hand-off leaves the ledger stale, never wrong, and the
// next reconcile run (or `npx tsx scripts/vater-credit-trueup.ts --all`)
// picks it up.
if (!DRY && adjusted.length > 0) {
  const { spawnSync } = await import('node:child_process');
  const res = spawnSync(
    'npx',
    ['tsx', new URL('vater-credit-trueup.ts', import.meta.url).pathname,
     '--projects', adjusted.join(','), '--apply'],
    { cwd: new URL('..', import.meta.url).pathname, stdio: 'inherit' },
  );
  if (res.status !== 0) {
    console.error(
      `   ! credit true-up hand-off failed (exit ${res.status ?? 'spawn error'}) for ` +
      `${adjusted.length} project(s). Ledger is STALE, not wrong — re-run:\n` +
      `     npx tsx scripts/vater-credit-trueup.ts --projects ${adjusted.join(',')} --apply`,
    );
  }
}

console.log(changed ? `\n${changed} project(s) ${DRY ? 'would be' : ''} updated.` : 'All project costs already accurate.');
await prisma.$disconnect();
