#!/usr/bin/env node
/**
 * vater-cost-drift.mjs — nightly "did any Modal spend miss the cards?" alarm.
 *
 * The cost chain has one blind spot no amount of merging fixes: money Modal
 * charged for work that vater_jobs.json never recorded. #21 spent $22.90 on
 * three renders and its card said $1.87, and nothing noticed until Trey's
 * invoice was already wrong. This compares the two sides that should agree:
 *
 *   Modal billing for the vater-* AND jelly-* apps  vs  the Modal share of
 *   every Vater project's costJson, over the same window.
 *
 * Both lanes are counted (2026-08-17). Since the customer lane split off onto
 * `jelly-*` apps, filtering to `vater-*` alone would have made every beta
 * user's spend invisible AND driven the drift negative — the alarm would go
 * quiet exactly as the money started coming from someone other than Trey.
 * `lady-*` stays excluded: different business, different books.
 *
 * The per-lane and per-tenant breakdowns come from ~/vater-studio/ledger.jsonl,
 * which stamps `lane` and `ownerId` on every row the pipeline books, so an
 * alarm can say WHOSE spend drifted instead of only how much.
 *
 * Over the threshold it writes a warning to ~/vater-studio/ledger.jsonl and
 * pings Telegram. It NEVER edits costJson — a drift is a question for a human
 * (which project? true-up or dev spend?), and guessing is how cards go wrong.
 *
 * The ledger warning carries `usd: 0` deliberately: ledger dollars roll up
 * into the /animate cost pill via push-vater-update.mjs --costs-from-ledger,
 * and an alarm must never bill Trey for itself.
 *
 *   node scripts/vater-cost-drift.mjs                 # last 7 days
 *   node scripts/vater-cost-drift.mjs --days 3 --threshold 5
 *   node scripts/vater-cost-drift.mjs --dry-run       # report only, no writes
 *   node scripts/vater-cost-drift.mjs --json
 */
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';

const SITE_ROOT = '/home/jelly/tolley-site';
const require = createRequire(`${SITE_ROOT}/package.json`);
const { PrismaClient } = require('@prisma/client');

const LEDGER = '/home/jelly/vater-studio/ledger.jsonl';
const STATE = '/home/jelly/vater-studio/.cost-drift-state.json';
const MODAL = '/home/jelly/.local/bin/modal';
const NOTIFY_ENV = '/home/jelly/.config/actioncam-notify.env';
const TELEGRAM_CHAT = '1680894605'; // Jared
// Both /animate lanes. lady-* is a different business and stays out.
const APP_PREFIXES = ['vater-', 'jelly-'];
/** Lane an app name belongs to: 'vater-wan22' -> 'vater'. */
const laneOfApp = (app) => String(app).split('-')[0];

const argv = process.argv.slice(2);
const arg = (f, d) => {
  const i = argv.indexOf(f);
  return i >= 0 ? argv[i + 1] : d;
};
const DAYS = Math.max(1, Number(arg('--days', 7)));
const THRESHOLD = Number(arg('--threshold', 2));
const DRY = argv.includes('--dry-run');
const AS_JSON = argv.includes('--json');

const r2 = (n) => Math.round(n * 100) / 100;
const day = (d) => d.toISOString().slice(0, 10);

const now = new Date();
const start = new Date(now.getTime() - DAYS * 86400_000);
const END = day(new Date(now.getTime() + 86400_000)); // end is exclusive
const START = day(start);

/** Modal's own billing, per app, for the window. */
function modalSpend() {
  const raw = execFileSync(MODAL, ['billing', 'report', '--start', START, '--end', END, '--json'], {
    encoding: 'utf8',
    timeout: 180_000,
  });
  const rows = JSON.parse(raw);
  const byApp = {};
  for (const row of rows) {
    const app = String(row.description ?? '');
    if (!APP_PREFIXES.some((pre) => app.startsWith(pre))) continue;
    byApp[app] = r2((byApp[app] ?? 0) + Number(row.cost ?? 0));
  }
  return byApp;
}

/** When a project's money was BOOKED, which is not when the row was last
 *  touched: the 8/12 renumbering bumped updatedAt on all 227 rows at once and
 *  dragged the entire library into every window. costJson carries its own
 *  timestamps — the pipeline's capture and the reconciler's write — and those
 *  are the moments cost actually moved. */
function bookedAt(p) {
  const c = p.costJson ?? {};
  const ms = (t) => (t ? new Date(t).getTime() : NaN);
  const own = [ms(c.updatedAt), ms(c.reconciledAt)].filter(Number.isFinite);
  if (own.length) return new Date(Math.max(...own));
  // No cost timestamps (pre-capture rows): fall back to the row's own dates.
  const row = [ms(p.completedAt), ms(p.updatedAt)].filter(Number.isFinite);
  return row.length ? new Date(Math.max(...row)) : new Date(0);
}

/** The Modal share of a project's booked cost. Pipelines that record a
 *  modalUsd split are taken at their word; otherwise back it out of the total
 *  by removing the providers we know are not Modal. */
function bookedModalUsd(costJson) {
  const c = costJson ?? {};
  const modal = Number(c.modalUsd);
  if (Number.isFinite(modal) && modal > 0) return modal;
  const total = Number(c.totalUsd) || 0;
  const nonModal =
    (Number(c.geminiUsd) || 0) + (Number(c.falUsd) || 0) +
    (Number(c.llmUsd) || 0) + (Number(c.otherUsd) || 0);
  return Math.max(0, total - nonModal);
}

/**
 * The pipeline's own record of who spent what, from ~/vater-studio/ledger.jsonl.
 *
 * This is the ONLY place a Modal dollar can be tied to a tenant. Modal's
 * billing rows carry no user field, so without this the alarm can say "the
 * cards are $22 light" but never "on whose renders" — which is exactly the
 * question that made #21 take a week to unpick.
 *
 * Rows written before 2026-08-17 have no `lane`/`ownerId`; they are all
 * pre-split owner spend, so an absent lane reads as `vater` and an absent
 * owner as "unattributed" rather than being dropped.
 */
function ledgerModalSpend() {
  const byLane = {};
  const byOwner = {};
  let rows = 0;
  let text = '';
  try {
    text = readFileSync(LEDGER, 'utf8');
  } catch {
    return { byLane, byOwner, rows };
  }
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    let e;
    try { e = JSON.parse(line); } catch { continue; }
    if (e.source !== 'modal') continue;
    const ts = new Date(e.ts).getTime();
    if (!Number.isFinite(ts) || ts < start.getTime()) continue;
    const usd = Number(e.usd) || 0;
    if (usd <= 0) continue;
    const lane = e.lane || 'vater';
    const owner = e.ownerId || 'unattributed';
    byLane[lane] = r2((byLane[lane] ?? 0) + usd);
    byOwner[owner] = r2((byOwner[owner] ?? 0) + usd);
    rows += 1;
  }
  return { byLane, byOwner, rows };
}

const prisma = new PrismaClient();
const allProjects = await prisma.youTubeProject.findMany({
  select: {
    id: true, sourceTitle: true, publishTitle: true, costJson: true,
    completedAt: true, updatedAt: true,
  },
});
await prisma.$disconnect();

// Only rows that booked Modal dollars matter here; the rest would just inflate
// the "cards compared" count with library entries that never cost anything.
const projects = allProjects.filter((p) => bookedModalUsd(p.costJson) > 0 && bookedAt(p) >= start);
const byApp = modalSpend();
const modalUsd = r2(Object.values(byApp).reduce((a, b) => a + b, 0));
// Modal's side, folded to lanes, next to the pipeline's own per-tenant record.
const modalByLane = {};
for (const [app, usd] of Object.entries(byApp)) {
  const lane = laneOfApp(app);
  modalByLane[lane] = r2((modalByLane[lane] ?? 0) + usd);
}
const ledger = ledgerModalSpend();
const bookedUsd = r2(projects.reduce((a, p) => a + bookedModalUsd(p.costJson), 0));
const driftUsd = r2(modalUsd - bookedUsd);
const over = driftUsd > THRESHOLD;

const report = {
  window: { start: START, end: END, days: DAYS },
  apps: byApp,
  /** Modal's billing folded to lanes: what each lane actually cost. */
  modalByLane,
  /** The pipeline's own attribution for the same window. A lane total here
   *  that is far under `modalByLane` means that lane booked spend it never
   *  recorded — the same blind spot as the headline drift, but scoped. */
  ledgerByLane: ledger.byLane,
  ledgerByOwner: ledger.byOwner,
  ledgerRows: ledger.rows,
  modalUsd,
  bookedUsd,
  driftUsd,
  thresholdUsd: THRESHOLD,
  projectsTouched: projects.length,
  alert: over,
};

if (AS_JSON) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log(`Modal billing ${START}..${END} (vater-* + jelly-*): $${modalUsd.toFixed(2)}  ` +
    `(${Object.entries(byApp).map(([a, v]) => `${a} $${v.toFixed(2)}`).join(', ') || 'no charges'})`);
  const laneLine = Object.entries(modalByLane)
    .sort((a, b) => b[1] - a[1])
    .map(([l, v]) => `${l} $${v.toFixed(2)}`).join(', ');
  console.log(`  by lane: ${laneLine || 'none'}   ` +
    `(vater = Trey's own renders, jelly = /animate customers)`);
  const ownerLine = Object.entries(ledger.byOwner)
    .sort((a, b) => b[1] - a[1]).slice(0, 8)
    .map(([o, v]) => `${o} $${v.toFixed(2)}`).join(', ');
  console.log(`  ledger attribution (${ledger.rows} row(s)): ${ownerLine || 'none'}`);
  console.log(`Booked on ${projects.length} project card(s) with Modal spend in window: $${bookedUsd.toFixed(2)}`);
  console.log(`Drift: $${driftUsd.toFixed(2)}  (threshold $${THRESHOLD.toFixed(2)}) — ${over ? 'ALERT' : 'ok'}`);
}

if (!over || DRY) process.exit(0);

// Don't re-ping for a drift that is already reported and unchanged — this runs
// nightly, but a human re-running it should not fire the same alert twice.
let state = {};
try {
  state = JSON.parse(readFileSync(STATE, 'utf8'));
} catch { /* first run */ }
const sameDay = state.lastAlertDay === day(now);
const sameSize = Math.abs(Number(state.lastDriftUsd ?? 0) - driftUsd) < 0.5;
if (sameDay && sameSize) {
  console.log('(already alerted today at this size — not repeating)');
  process.exit(0);
}

const biggest = Object.entries(byApp).sort((a, b) => b[1] - a[1])[0];
const laneSummary = Object.entries(modalByLane)
  .sort((a, b) => b[1] - a[1])
  .map(([l, v]) => `${l} $${v.toFixed(2)}`).join(', ') || 'none';
const topOwner = Object.entries(ledger.byOwner).sort((a, b) => b[1] - a[1])[0];
const note =
  `Vater cost drift $${driftUsd.toFixed(2)} over ${DAYS}d: Modal billed ` +
  `$${modalUsd.toFixed(2)} for vater-*/jelly-* apps, project cards book $${bookedUsd.toFixed(2)}. ` +
  `By lane: ${laneSummary}. ` +
  `Top tenant in ledger: ${topOwner ? `${topOwner[0]} $${topOwner[1].toFixed(2)}` : 'n/a'}. ` +
  `Biggest app: ${biggest ? `${biggest[0]} $${biggest[1].toFixed(2)}` : 'n/a'}. ` +
  `Spend may be missing from a card — book it into costJson.byStage.reconciliation ` +
  `(and totalUsd) if it belongs to a video.`;

appendFileSync(LEDGER, JSON.stringify({
  ts: now.toISOString(),
  kind: 'drift-warning',
  source: 'audit',
  usd: 0, // alarms never bill — see header
  driftUsd,
  modalUsd,
  bookedUsd,
  modalByLane,
  window: `${START}..${END}`,
  note,
}) + '\n');

function telegramToken() {
  if (process.env.TELEGRAM_BOT_TOKEN) return process.env.TELEGRAM_BOT_TOKEN;
  const line = readFileSync(NOTIFY_ENV, 'utf8').split('\n')
    .find((l) => l.trim().startsWith('TELEGRAM_BOT_TOKEN='));
  return line ? line.slice(line.indexOf('=') + 1).trim() : undefined;
}

let sent = false;
try {
  const token = telegramToken();
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN not found');
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      chat_id: TELEGRAM_CHAT,
      disable_web_page_preview: true,
      text: `⚠️ ${note}\n\nLibrary: https://gx10-adc6.taile5cde9.ts.net:8444/animate#r=library`,
    }),
  });
  sent = res.ok;
  if (!res.ok) console.error(`telegram ${res.status}: ${(await res.text()).slice(0, 200)}`);
} catch (err) {
  console.error(`telegram send failed: ${err.message}`);
}

writeFileSync(STATE, JSON.stringify({
  lastAlertDay: day(now),
  lastDriftUsd: driftUsd,
  lastRunAt: now.toISOString(),
  telegramSent: sent,
}, null, 2) + '\n');

console.log(`drift warning written to ledger.jsonl${sent ? ' + Telegram sent' : ''}`);
