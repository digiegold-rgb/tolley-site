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
  const total = Number(Object.values(byJob).reduce((a, b) => a + b, 0).toFixed(2));
  if (!total) continue;

  const prev = Number(p.costJson?.totalUsd ?? 0);
  if (Math.abs(prev - total) < 0.005) continue;

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
}

console.log(changed ? `\n${changed} project(s) ${DRY ? 'would be' : ''} updated.` : 'All project costs already accurate.');
await prisma.$disconnect();
