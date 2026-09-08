#!/usr/bin/env node
/**
 * push-video-costs.mjs — push what every video cost to make up to tolley.io so
 * the /hq Posts tab can show a per-video price and an all-time grand total.
 * Companion to push-video-map.mjs; safe to re-run (upsert on videoKey).
 *
 * Sources, in order of how much they actually know:
 *   1. shorts/posted.json      — the render pipeline's OWN numbers (aiClips.estCost,
 *                                lipsync.estCost) plus real X posting spend.
 *   2. housing-hub/out/<date>/ — video-cost.json when run_daily wrote one,
 *                                otherwise the estimate constants below.
 *   3. wd-content/out/<date>/  — W/D weekly videos, same treatment.
 *   4. `modal billing report`  — real metered app-compute per month; whatever
 *                                the per-video rows don't account for goes in
 *                                one allocated "overhead" row per month.
 *                                This is not a reconciled provider ledger.
 *
 * Pipeline estCost fields and heuristic allocations are marked estimated:true.
 *
 * Auth: SYNC_SECRET (env, or parsed from tolley-site/.env.local).
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const POSTED = "/home/jelly/growth-engine/shorts/posted.json";
const HOUSING_OUT = "/home/jelly/housing-hub/out";
const WD_OUT = "/home/jelly/growth-engine/wd-content/out";
const ENV_LOCAL = "/home/jelly/tolley-site/.env.local";
const BASE = process.env.TOLLEY_BASE || "https://www.tolley.io";

// ── estimate constants ────────────────────────────────────────────────────────
// Kimi K3 gives no per-call billing readout, so the storyboard is a flat
// per-video estimate. daily-shorts-cron.sh set SHORTS_SCRIPT_PROVIDER=kimi on
// 2026-07-27; before that scripts came from local Qwen and cost nothing.
const KIMI_SCRIPT_CENTS = 20;
const KIMI_FROM = "2026-07-27";
// X is the only posting leg with a per-post price (POST-with-URL, $0.21).
const X_POST_CENTS = 21;
// Housing daily went persona (Kimi script + Wan clips) on 2026-07-29 —
// housing_short.py declares $0.90 for that tier. Before that it was Vater on
// local DGX GPU: no API spend to bill.
const HOUSING_PERSONA_FROM = "2026-07-29";
const HOUSING_PERSONA_CLIP_CENTS = 70;
// listings_video.py: MLS photos + local Qwen script are free. The VOICE was
// ElevenLabs (~98s/video ≈ $0.25) through 2026-07-28 — caught by Jared 7/31 —
// then ported to local IndexTTS-2 the same day ("our own voice, no more 11
// labs"), so renders after the EL era cost $0 again.
const LOCAL_RENDER_CENTS = 0;
const LISTINGS_EL_TTS_CENTS = 25;
const LISTINGS_EL_UNTIL = "2026-07-29"; // last EL render was 7/28
// Nano Banana 2 keyframe photos (scene_frames.py, gemini-3.1-flash-image-preview):
// no per-call billing readout, so a flat per-image estimate. Shorts record the
// real sceneFrames count; persona-era housing/W-D renders without declared meta
// get an 8-frame assumption. Both are constants, so rows carry estimated:true.
const IMAGE_CENTS_EACH = 4;
const PERSONA_FRAMES_ASSUMED = 8;

function syncSecret() {
  if (process.env.SYNC_SECRET) return process.env.SYNC_SECRET.trim();
  const line = fs
    .readFileSync(ENV_LOCAL, "utf8")
    .split("\n")
    .find((l) => l.startsWith("SYNC_SECRET="));
  if (!line) throw new Error("SYNC_SECRET not in env or tolley-site/.env.local");
  return line.slice("SYNC_SECRET=".length).trim();
}

const toCents = (dollars) => Math.round((Number(dollars) || 0) * 100);

// videoKey is the upsert key, so it has to be byte-stable across runs. A few
// early renders were made with a relative --outdir and recorded a relative
// `video` in posted.json; those became relative videoKeys that can never match
// an absolute one, so every sync re-inserted instead of updating. Resolve
// against the shorts dir (where `review/` lives) — that is the only base a
// relative render path was ever written against.
const SHORTS_DIR = "/home/jelly/growth-engine/shorts";
const absKey = (p) => (path.isAbsolute(p) ? p : path.resolve(SHORTS_DIR, p));

function firstLiveUrl(platforms = {}) {
  for (const leg of Object.values(platforms)) {
    if (leg?.ok && typeof leg.url === "string" && leg.url) return leg.url;
  }
  return null;
}

const rows = [];

// ── 1. product shorts ─────────────────────────────────────────────────────────
if (fs.existsSync(POSTED)) {
  const entries = JSON.parse(fs.readFileSync(POSTED, "utf8")).entries || [];
  for (const e of entries) {
    if (!e?.video || !e?.renderedAt) continue;
    // Absent aiClips means the static-imagery era, not a missing measurement:
    // those renders generated no clips, so zero is the true number.
    const clipsCents = toCents(e.aiClips?.estCost);
    const lipsyncCents = toCents(e.lipsync?.estCost);
    // scriptCost is recorded from 2026-07-31 on (it knows whether Kimi or the
    // local Qwen fallback actually wrote it); older rows only have the date.
    const recordedScript = typeof e.scriptCost === "number";
    const scriptCents = recordedScript
      ? toCents(e.scriptCost)
      : e.renderedAt >= KIMI_FROM
        ? KIMI_SCRIPT_CENTS
        : 0;
    const postCents = e.platforms?.x?.ok ? X_POST_CENTS : 0;
    const imageCents = (Number(e.sceneFrames) || 0) * IMAGE_CENTS_EACH;
    // Clips render on Modal wan22 unless the premium fal Kling bridge was used
    // (fal_clips.py) — the distinction matters for the Modal reconciliation row.
    const modalClips = clipsCents > 0 && !String(e.aiClips?.variant || "").includes("kling");
    rows.push({
      videoKey: absKey(e.video),
      pipeline: "shorts",
      modalClips,
      title: e.title || path.basename(e.video),
      template: e.template || null,
      status: e.status === "posted" ? "posted" : "draft",
      url: firstLiveUrl(e.platforms),
      clipsCents,
      lipsyncCents,
      imageCents,
      scriptCents,
      ttsCents: 0,
      postCents,
      estimated: clipsCents > 0 || lipsyncCents > 0 || imageCents > 0 || scriptCents > 0 || postCents > 0,
      renderedAt: e.renderedAt,
    });
  }
}

// ── 2. housing daily + listings ───────────────────────────────────────────────
function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

// The day directory is the authoritative production date; file mtime is not.
// mtime is local (CDT), and renderedAt is stored as UTC — so anything rendered
// after 19:00 CDT used to file under the NEXT day. The 7-city listings run
// finishes ~21:00, which pushed all seven renders a day forward. Noon UTC is
// the same calendar day in both UTC and US Central, so the date can't drift.
const dayTimestamp = (day) => `${day}T12:00:00.000Z`;

if (fs.existsSync(HOUSING_OUT)) {
  for (const day of fs.readdirSync(HOUSING_OUT).sort()) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) continue;
    const dir = path.join(HOUSING_OUT, day);

    // video.mp4 is the canonical daily short — the persona-named render beside
    // it is the same bytes, so keying on video.mp4 avoids double counting.
    const daily = path.join(dir, "video.mp4");
    if (fs.existsSync(daily)) {
      const declared = readJson(path.join(dir, "video-cost.json"));
      const persona = day >= HOUSING_PERSONA_FROM;
      rows.push({
        videoKey: daily,
        pipeline: "housing",
        modalClips: true, // persona-era Wan clips render on Modal; vater-era rows carry $0 anyway
        title: declared?.title || `KC Housing Daily — ${day}`,
        template: declared?.style || (persona ? "persona" : "vater"),
        status: declared?.url ? "posted" : "rendered",
        url: declared?.url || null,
        clipsCents: declared ? toCents(declared.clipsCost) : persona ? HOUSING_PERSONA_CLIP_CENTS : LOCAL_RENDER_CENTS,
        lipsyncCents: declared ? toCents(declared.lipsyncCost) : 0,
        imageCents: (declared?.sceneFrames ?? (persona ? PERSONA_FRAMES_ASSUMED : 0)) * IMAGE_CENTS_EACH,
        scriptCents: declared ? toCents(declared.scriptCost) : persona ? KIMI_SCRIPT_CENTS : 0,
        ttsCents: 0,
        postCents: 0,
        estimated: true,
        renderedAt: dayTimestamp(day),
      });
    }

    // Listings videos: the single-city era wrote <date>/listings_video.mp4.
    // The 7-city expansion (2026-08) writes <date>/<city>/listings_video.mp4 —
    // one render per city, each its own TTS pass, so each is its own row. The
    // root file is still read so historical rows keep their videoKey and don't
    // orphan. Only these two shapes are produced; anything deeper is not a
    // listings render and is deliberately ignored.
    const listingsFiles = [];
    const rootListing = path.join(dir, "listings_video.mp4");
    if (fs.existsSync(rootListing)) listingsFiles.push({ file: rootListing, city: null });
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const cityListing = path.join(dir, entry.name, "listings_video.mp4");
      if (fs.existsSync(cityListing)) listingsFiles.push({ file: cityListing, city: entry.name });
    }

    for (const { file, city } of listingsFiles) {
      const label = city
        ? city.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
        : null;
      // listings_cost.json (2026-08-11+): the render's OWN measurement of TTS
      // backend spend (Modal wallS metered, EL calls counted, local = 0).
      // When present it beats every constant below.
      const measured = readJson(path.join(path.dirname(file), "listings_cost.json"));
      rows.push({
        videoKey: file,
        pipeline: "listings",
        title: label ? `New Homes Today — ${label} — ${day}` : `New KC Homes Today — ${day}`,
        template: measured?.ttsBackends
          ? `slideshow/${Object.keys(measured.ttsBackends).join("+")}`
          : "slideshow",
        status: "rendered",
        url: null,
        clipsCents: LOCAL_RENDER_CENTS,
        lipsyncCents: 0,
        imageCents: 0,
        scriptCents: 0,
        // Each city render does its own narration, so the EL-era per-video
        // voice cost applies per file, not per day.
        ttsCents: measured
          ? Math.max(0, Math.round(Number(measured.ttsCents) || 0))
          : day < LISTINGS_EL_UNTIL
            ? LISTINGS_EL_TTS_CENTS
            : 0,
        postCents: 0,
        estimated: measured ? !!measured.estimated : true,
        renderedAt: dayTimestamp(day),
      });
    }
  }
}

// ── 3. W/D weekly ─────────────────────────────────────────────────────────────
if (fs.existsSync(WD_OUT)) {
  for (const day of fs.readdirSync(WD_OUT).sort()) {
    const dir = path.join(WD_OUT, day);
    if (!fs.statSync(dir).isDirectory()) continue;
    for (const f of fs.readdirSync(dir).filter((n) => n.endsWith(".mp4"))) {
      const file = path.join(dir, f);
      const declared = readJson(file.replace(/\.mp4$/, ".json"));
      rows.push({
        videoKey: file,
        pipeline: "wd",
        modalClips: true, // same persona pipeline as housing — Wan clips on Modal
        title: declared?.title || `W/D weekly — ${day}`,
        template: declared?.template || null,
        status: declared?.url ? "posted" : "rendered",
        url: null,
        clipsCents: declared ? toCents(declared.aiClips?.estCost) : HOUSING_PERSONA_CLIP_CENTS,
        lipsyncCents: declared ? toCents(declared.lipsync?.estCost) : 0,
        imageCents: (Number(declared?.sceneFrames) || PERSONA_FRAMES_ASSUMED) * IMAGE_CENTS_EACH,
        scriptCents: KIMI_SCRIPT_CENTS,
        ttsCents: 0,
        postCents: 0,
        estimated: true,
        renderedAt: new Date(fs.statSync(file).mtime).toISOString(),
      });
    }
  }
}

// ── 4. Modal reconciliation — the bill nobody's video admits to ──────────────
// The rows above are happy-path recipe estimates; Modal also bills cold starts,
// warm pools, retries, failed renders and experiments that never shipped. One
// synthetic "overhead" row per month carries real-bill-minus-attributed so the
// tab's grand total reconciles to `modal billing report` instead of implying
// the shipped videos were the whole cost. (Kimi scripts bill as llm_tokens,
// not apps, so they're deliberately NOT subtracted from the apps number.)
const MODAL_BIN = "/home/jelly/.local/bin/modal";
const MODAL_FIRST_DAY = "2026-02-01";

const attributedModal = new Map(); // "YYYY-MM" → cents already claimed by videos
for (const r of rows) {
  if (!r.modalClips) continue;
  const m = String(r.renderedAt).slice(0, 7);
  attributedModal.set(m, (attributedModal.get(m) || 0) + r.clipsCents);
}

// Modal rate-limits `billing summary` per workspace, and the hourly cron hits
// it once per month-since-February on every run. Previously one 429 threw out
// of the whole loop, so a limit hit while fetching 2026-03 silently dropped
// every later month too — that is why 2026-03 and 2026-05 never reconciled.
// Now: pace the calls, retry each month with exponential backoff, and let a
// month that still fails fall through without taking the others with it.
const MODAL_MAX_ATTEMPTS = 5;
const MODAL_BASE_DELAY_MS = 2_000;
const MODAL_PACE_MS = 1_500; // between months, to avoid tripping the limit at all

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function modalBilling(args) {
  let delay = MODAL_BASE_DELAY_MS;
  for (let attempt = 1; attempt <= MODAL_MAX_ATTEMPTS; attempt++) {
    try {
      return execFileSync(MODAL_BIN, args, {
        encoding: "utf8",
        timeout: 60_000,
        stdio: ["ignore", "pipe", "pipe"],
      });
    } catch (e) {
      const blob = `${e.stdout || ""}${e.stderr || ""}${e.message || ""}`;
      if (!/rate limit/i.test(blob)) throw new Error(blob.trim().slice(0, 200));
      if (attempt === MODAL_MAX_ATTEMPTS) {
        throw new Error(`rate limited after ${MODAL_MAX_ATTEMPTS} attempts`);
      }
      // Full jitter, so concurrent runs (cron + a manual sync) don't retry in lockstep.
      const wait = delay + Math.floor(Math.random() * 1_000);
      console.error(
        `push-video-costs: modal ${args.join(" ")} rate limited — retry ${attempt}/${MODAL_MAX_ATTEMPTS - 1} in ${wait}ms`,
      );
      await sleep(wait);
      delay *= 2;
    }
  }
}

const modalSummary = (month) =>
  modalBilling(["billing", "summary", "--for", month, "--json"]);
const modalReport = (month) => {
  const [y, mo] = month.split("-").map(Number);
  const end = mo === 12 ? `${y + 1}-01-01` : `${y}-${String(mo + 1).padStart(2, "0")}-01`;
  return modalBilling(["billing", "report", "--start", `${month}-01`, "--end", end, "--json"]);
};

// 2026-08-07: wan22 was split into two deployed apps for billing separation —
// lady-wan22 (Jared: shorts, persona dailies, bitcoin-kids, clients) and
// vater-wan22 (Trey's /animate studio; vater-firered is his stills app). This
// ledger is Jared's, so from the split month on we count ONLY lady-side apps
// from the per-app `billing report` instead of the workspace-wide summary.
const MODAL_SPLIT_MONTH = "2026-08";
const LADY_APPS = new Set(["lady-wan22"]);
// August is the one mixed month: everything ran on vater-wan22 through 08-06.
// Trey's 8/5–8/6 test renders on it were trued up at $15.00 in the vater
// ledger, $3.38 of which was vater-firered — so $11.62 of pre-split
// vater-wan22 spend is his, the rest is Jared's.
const PRE_SPLIT_CUTOFF = "2026-08-07";
const VATER_PRE_SPLIT_WAN22_CENTS = 1162;

async function ladyAppsDollars(month) {
  const rows = JSON.parse(await modalReport(month));
  let dollars = 0;
  for (const r of rows) {
    const day = String(r.interval_start).slice(0, 10);
    const isPreSplitShared = r.description === "vater-wan22" && day < PRE_SPLIT_CUTOFF;
    if (LADY_APPS.has(r.description) || isPreSplitShared) dollars += Number(r.cost) || 0;
  }
  if (month === MODAL_SPLIT_MONTH) dollars -= VATER_PRE_SPLIT_WAN22_CENTS / 100;
  return Math.max(0, dollars);
}

// `billing report` caps daily ranges at 31 days, so walk month by month with
// `billing summary` (same recipe as collect-ai-spend.mjs). deployed_apps is
// the metered GPU-compute number — volumes (waived free storage) and
// llm_tokens (Kimi, estimated separately per video) stay out on purpose.
const months = [];
const now = new Date();
for (
  let d = new Date(`${MODAL_FIRST_DAY}T00:00:00Z`);
  d <= now;
  d.setUTCMonth(d.getUTCMonth() + 1)
) {
  months.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
}

const modalSkipped = [];
for (const [i, m] of months.entries()) {
  if (i > 0) await sleep(MODAL_PACE_MS);
  let appsDollars;
  try {
    // Pre-split months: workspace-wide summary (all spend was Jared's).
    // Split months: per-app report filtered to lady-side apps.
    appsDollars =
      m < MODAL_SPLIT_MONTH
        ? Number(JSON.parse(await modalSummary(m))?.metered_cost_breakdown?.deployed_apps) || 0
        : await ladyAppsDollars(m);
  } catch (e) {
    modalSkipped.push(m);
    console.error(`push-video-costs: modal ${m} skipped — ${e.message}`);
    continue;
  }
  const burnCents = Math.round(appsDollars * 100) - (attributedModal.get(m) || 0);
  // Push a zero remainder too, so an old nonzero overhead row can clear.
  rows.push({
    videoKey: `modal-gpu-burn:${m}`,
    pipeline: "overhead",
    title: `Modal GPU overhead — retries, warm pools & experiments (${m})`,
    template: "modal-reconciliation",
    status: "posted",
    url: null,
    clipsCents: Math.max(0, burnCents),
    lipsyncCents: 0,
    imageCents: 0,
    scriptCents: 0,
    ttsCents: 0,
    postCents: 0,
    estimated: true, // selected metered app costs minus estimated allocation
    renderedAt: `${m}-01T00:00:00.000Z`,
  });
}
if (modalSkipped.length) {
  // Loud on purpose: a silent gap here reads as "$0 overhead that month".
  console.error(
    `push-video-costs: modal reconciliation INCOMPLETE for ${modalSkipped.join(", ")} — those months keep their last-synced overhead row`,
  );
}

if (rows.length === 0) {
  console.log("push-video-costs: no videos found, nothing to push");
  process.exit(0);
}

const grand = rows.reduce(
  (s, r) => s + r.clipsCents + r.lipsyncCents + r.imageCents + r.scriptCents + r.ttsCents + r.postCents,
  0,
);

if (process.argv.includes("--dry-run")) {
  console.log(JSON.stringify({ mode: "review", records: rows.length, recordedCents: grand, estimatedRecords: rows.filter(r => r.estimated).length, modalSkipped }));
  process.exit(modalSkipped.length ? 2 : 0);
}

let upserted = 0;
// Bounded batches prevent a large legacy ledger from timing out mid-request.
for (let offset = 0; offset < rows.length; offset += 50) {
const res = await fetch(`${BASE}/api/hq/video-costs`, {
  method: "POST",
  headers: { "Content-Type": "application/json", "x-sync-secret": syncSecret() },
  body: JSON.stringify(rows.slice(offset, offset + 50)),
  signal: AbortSignal.timeout(120000),
});
const json = await res.json().catch(() => ({}));
if (!res.ok) {
  console.error(`push-video-costs: batch failed (${res.status})`);
  process.exit(1);
}
upserted += json.upserted || 0;
}
console.log(
  `push-video-costs: refreshed ${upserted} cost records; amounts include estimates and selected overhead, not a reconciled provider total`,
);
if (modalSkipped.length) process.exitCode = 2;
