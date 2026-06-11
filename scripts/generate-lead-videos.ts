/**
 * scripts/generate-lead-videos.ts
 *
 * B2B "I made you a video" — batch-generate ~15-second promo videos for
 * GrowthLead rows (offer=video, stage=scraped, no videoUrl yet), upload the
 * mp4 to Vercel Blob, and flip the lead to stage=demo_built with
 * videoUrl=/v/<slug> + videoAssetUrl=<blob url>. The page at app/v/[slug]
 * renders entirely from those two fields.
 *
 * Pipeline: builds a 3-beat promo script from the lead's REAL data (name,
 * category, rating/reviews, city), then drives the DGX Content Autopilot
 * end-to-end via POST /vater/run-creation with `scriptOverride` (mode=topic,
 * videoBackend=sdxl → still scenes + Ken Burns, composed to final.mp4 on the
 * DGX). We poll /vater/jobs/<id> until done and download
 * /vater/file/<jobId>/video.
 *
 * NOTE: this intentionally does NOT import lib/vater/autopilot-client.ts —
 * that module is `import "server-only"` and throws outside Next.js. The tiny
 * client below mirrors its auth + endpoints exactly (AUTOPILOT_URL +
 * CONTENT_API_KEY bearer).
 *
 * ── Animation upgrade (documented, not wired) ────────────────────────────
 * The sdxl backend ships a working Ken Burns video today. To upgrade scenes
 * to real i2v motion (quality "modal-hunyuan-narrative"), wire after the
 * run-creation job completes:
 *   1. scenes = job.result.scenesJson
 *   2. POST /vater/animate-all-scenes { jobId, scenes: [{sceneIdx,
 *      animationPrompt}...], quality: "modal-hunyuan-narrative" }
 *      → { animateAllJobId }; poll /vater/jobs/<animateAllJobId> until done.
 *   3. Re-compose with the animated clips: POST /vater/compose-video
 *      { jobId, props: <VideoSpec> } — the VideoSpec must be built like
 *      lib/vater/video-spec.ts buildVideoSpec() does from a YouTubeProject
 *      row (scenes + audioUrl + captionTimings). That builder is coupled to
 *      project rows, which is why this script ships the sdxl compose instead.
 *
 * Usage (from tolley-site/):
 *   npx tsx scripts/generate-lead-videos.ts [--limit N] [--dry-run] [--voice NAME]
 *
 * Env (.env.local, loaded below): DATABASE_URL, AUTOPILOT_URL,
 * CONTENT_API_KEY, BLOB_READ_WRITE_TOKEN. Optional B2B_VIDEO_VOICE (or
 * --voice) — defaults to the first voice clone on the DGX.
 *
 * Per-lead failures are caught + logged loudly; the batch continues.
 */

import { PrismaClient } from "@prisma/client";
import { put } from "@vercel/blob";
import { existsSync, readFileSync } from "fs";
import { join } from "path";

// ── env loading (same pattern as scripts/stripe-invoice-reconcile.ts) ──────
function loadEnvFile(p: string) {
  if (!existsSync(p)) return;
  for (const raw of readFileSync(p, "utf8").split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
}
loadEnvFile(join(process.cwd(), ".env.local"));

const prisma = new PrismaClient();

// ── CLI args ────────────────────────────────────────────────────────────────
function argNum(k: string, d: number): number {
  const i = process.argv.indexOf(k);
  if (i === -1) return d;
  const n = Number(process.argv[i + 1]);
  if (!Number.isInteger(n) || n < 1 || n > 100) {
    throw new Error(`${k} must be an integer 1-100, got "${process.argv[i + 1]}"`);
  }
  return n;
}
function argStr(k: string): string | null {
  const i = process.argv.indexOf(k);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : null;
}
const LIMIT = argNum("--limit", 5);
const DRY_RUN = process.argv.includes("--dry-run");
const VOICE_ARG = argStr("--voice") || process.env.B2B_VIDEO_VOICE || null;

// ── minimal autopilot client (mirrors lib/vater/autopilot-client.ts) ───────
const AUTOPILOT_BASE = (process.env.AUTOPILOT_URL || "").replace(/\/$/, "");
const AUTOPILOT_KEY = process.env.CONTENT_API_KEY || "";

class AutopilotError extends Error {
  constructor(
    public status: number,
    public endpoint: string,
    body: string
  ) {
    super(`[autopilot ${status}] ${endpoint}: ${body || "(empty body)"}`);
    this.name = "AutopilotError";
  }
}

async function apCall<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${AUTOPILOT_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${AUTOPILOT_KEY}`,
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new AutopilotError(res.status, path, text || res.statusText);
  }
  return (await res.json()) as T;
}

type JobStatus = {
  status: "pending" | "running" | "done" | "failed" | string;
  phase: string;
  progress: number;
  result?: { finalVideoUrl?: string } & Record<string, unknown>;
  error?: string;
};

async function downloadFinalVideo(jobId: string): Promise<Buffer> {
  const res = await fetch(
    `${AUTOPILOT_BASE}/vater/file/${encodeURIComponent(jobId)}/video`,
    { headers: { Authorization: `Bearer ${AUTOPILOT_KEY}` } }
  );
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new AutopilotError(res.status, `/vater/file/${jobId}/video`, text || res.statusText);
  }
  return Buffer.from(await res.arrayBuffer());
}

/** Poll a run-creation job to terminal state. ~15s of video on sdxl usually
 *  lands in 3-8 min (TTS + scenes + compose); cap at 30 min. */
async function waitForJob(jobId: string, label: string): Promise<JobStatus> {
  const deadline = Date.now() + 30 * 60 * 1000;
  let lastPhase = "";
  for (;;) {
    const job = await apCall<JobStatus>("GET", `/vater/jobs/${encodeURIComponent(jobId)}`);
    if (job.phase !== lastPhase) {
      console.log(`    [${label}] phase=${job.phase} progress=${job.progress}%`);
      lastPhase = job.phase;
    }
    if (job.status === "done") return job;
    if (job.status === "failed") {
      throw new Error(`autopilot job ${jobId} failed: ${job.error || "(no error message)"}`);
    }
    if (Date.now() > deadline) {
      throw new Error(`autopilot job ${jobId} timed out after 30 min (phase=${job.phase})`);
    }
    await new Promise((r) => setTimeout(r, 10_000));
  }
}

// ── slug helpers (cloned from scripts/generate-demos.mjs) ──────────────────
function kebab(input: string): string {
  return String(input)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip accents
    .replace(/['’]/g, "") // drop apostrophes (don't split "Jet's" → jet-s)
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");
}

/** Unique slug from name (+city, +counter as needed). */
function uniqueSlug(name: string, city: string | null, taken: Set<string>): string {
  const base = kebab(name) || "local-business";
  const candidates = [base];
  if (city) candidates.push(kebab(`${name} ${city}`));
  for (const c of candidates) {
    if (c && !taken.has(c)) return c;
  }
  for (let i = 2; i < 100; i++) {
    const c = `${candidates[candidates.length - 1]}-${i}`;
    if (!taken.has(c)) return c;
  }
  throw new Error(`Could not generate unique slug for "${name}"`);
}

// ── promo script builder — 3 beats, ~38 words ≈ 15 s of narration ──────────
type Lead = {
  id: string;
  name: string;
  category: string | null;
  city: string | null;
  rating: number | null;
  reviews: number | null;
  score: number | null;
};

function buildPromoScript(lead: Lead): string {
  const city = lead.city || "the KC metro";
  const category = (lead.category || "local business").toLowerCase();

  // Beat 1 — hook: business name + what they do.
  const hook = `Looking for ${category} in ${city}? Meet ${lead.name}.`;

  // Beat 2 — social proof from REAL data only (never fabricate).
  const proof =
    lead.rating != null && lead.reviews != null && lead.reviews > 0
      ? `Rated ${lead.rating.toFixed(1)} stars by ${lead.reviews} real customers on Google.`
      : `A local team your neighbors in ${city} already trust.`;

  // Beat 3 — CTA with city.
  const cta = `Don't wait — call ${lead.name} in ${city} today.`;

  return `${hook}\n\n${proof}\n\n${cta}`;
}

// ── main ────────────────────────────────────────────────────────────────────
async function main() {
  if (!DRY_RUN) {
    if (!AUTOPILOT_BASE) throw new Error("AUTOPILOT_URL not set");
    if (!AUTOPILOT_KEY) throw new Error("CONTENT_API_KEY not set");
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      throw new Error("BLOB_READ_WRITE_TOKEN not set — required for @vercel/blob uploads");
    }
  }

  const leads = await prisma.growthLead.findMany({
    where: { offer: "video", stage: "scraped", videoUrl: null },
    orderBy: { score: "desc" },
    take: LIMIT,
    select: {
      id: true,
      name: true,
      category: true,
      city: true,
      rating: true,
      reviews: true,
      score: true,
    },
  });

  if (leads.length === 0) {
    console.log('Nothing to do — no offer="video" leads at stage=scraped without a videoUrl.');
    return;
  }

  // Existing /v/ slugs across ALL leads — dedupe target.
  const existing = await prisma.growthLead.findMany({
    where: { videoUrl: { not: null } },
    select: { videoUrl: true },
  });
  const taken = new Set(
    existing
      .map((l) => l.videoUrl || "")
      .filter((u) => u.startsWith("/v/"))
      .map((u) => u.slice("/v/".length))
  );

  // Resolve the voice clone once for the whole batch.
  let voice = VOICE_ARG;
  if (!voice && !DRY_RUN) {
    const data = await apCall<{ voices?: Array<{ name: string }> }>("GET", "/vater/voices");
    const voices = Array.isArray(data?.voices) ? data.voices : [];
    if (voices.length === 0) {
      throw new Error("No voice clones on the DGX — pass --voice NAME or set B2B_VIDEO_VOICE");
    }
    voice = voices[0].name;
    console.log(`Using voice clone "${voice}" (first available; override with --voice)`);
  }

  let built = 0;
  let failed = 0;

  for (const lead of leads) {
    const slug = uniqueSlug(lead.name, lead.city, taken);
    taken.add(slug);
    const script = buildPromoScript(lead);
    const wordCount = script.split(/\s+/).filter(Boolean).length;

    if (DRY_RUN) {
      console.log(`\n[dry-run] ${lead.name} (${lead.city || "?"}, score ${lead.score ?? "?"}) → /v/${slug}`);
      console.log(script.split("\n\n").map((l) => `    ${l}`).join("\n"));
      continue;
    }

    console.log(`\n▶ ${lead.name} (${lead.city || "?"}, score ${lead.score ?? "?"}) → /v/${slug}`);
    try {
      // 1. Kick the full creation pipeline with our pre-written 3-beat script.
      //    projectId is round-tripped only (no portal callback — the worker
      //    never touches Prisma), so a synthetic id is safe here.
      const { jobId } = await apCall<{ jobId: string }>("POST", "/vater/run-creation", {
        projectId: `b2bvideo-${lead.id}`,
        mode: "topic",
        topic: `${lead.name} — 15-second local promo`,
        goal: "Short punchy local-business promo ad",
        targetWordCount: wordCount,
        stylePreset: "cinematic",
        voiceCloneName: voice,
        videoBackend: "sdxl",
        scriptOverride: script,
      });
      console.log(`    autopilot job ${jobId}`);

      // 2. Wait for TTS → scenes → compose to finish on the DGX.
      const job = await waitForJob(jobId, lead.name);
      if (!job.result?.finalVideoUrl) {
        throw new Error(`job ${jobId} finished without finalVideoUrl`);
      }

      // 3. Pull final.mp4 off the DGX and push it to Vercel Blob (public).
      const buffer = await downloadFinalVideo(jobId);
      console.log(`    downloaded final.mp4 (${(buffer.length / 1024 / 1024).toFixed(1)} MB)`);
      const blob = await put(`b2b-videos/${slug}.mp4`, buffer, { access: "public" });
      console.log(`    blob → ${blob.url}`);

      // 4. Flip the lead: the watch page at /v/<slug> is now live.
      await prisma.growthLead.update({
        where: { id: lead.id },
        data: { videoUrl: `/v/${slug}`, videoAssetUrl: blob.url, stage: "demo_built" },
      });
      built++;
      console.log(`  ✓ ${lead.name} → https://www.tolley.io/v/${slug} (stage scraped → demo_built)`);
    } catch (err) {
      // One bad lead must not kill the batch — but be LOUD about it.
      failed++;
      console.error(`  ✗ FAILED for ${lead.name}:`, err instanceof Error ? err.message : err);
    }
  }

  console.log("─".repeat(60));
  console.log(
    DRY_RUN
      ? `dry-run complete: ${leads.length} leads would get videos`
      : `done: ${built} videos built, ${failed} failed (of ${leads.length} candidates)`
  );
  if (failed > 0) process.exitCode = 1;
}

main()
  .catch((err) => {
    console.error("\n❌ Fatal error:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
