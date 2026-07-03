/**
 * Regenerate the top-N video-offer demo pages through Modal Wan2.2 i2v
 * (animQuality=modal-wan22 + defaultAnimMode=all) so /v/<slug> is a real
 * animated promo, not Ken Burns stills. Reuses each lead's existing slug, so
 * URLs are stable. Idempotent-ish: skips slugs already known to be Modal.
 *
 *   npx tsx scripts/regenerate-top-video-demos.ts [--limit 10]
 *
 * Image descriptions come from Kimi (autopilot VATER_PLANNER_MODEL). ~$0.46
 * and ~11 min of Modal per video; runs strictly sequential to avoid overloading
 * the DGX GPU.
 */
import { PrismaClient } from "@prisma/client";
import { put } from "@vercel/blob";
import { existsSync, readFileSync } from "fs";
import { join } from "path";

function loadEnvFile(p: string) {
  if (!existsSync(p)) return;
  for (const raw of readFileSync(p, "utf8").split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
}
loadEnvFile(join(process.cwd(), ".env.local"));

const prisma = new PrismaClient();
const AP = (process.env.AUTOPILOT_URL || "").replace(/\/$/, "");
const KEY = process.env.CONTENT_API_KEY || "";

const li = process.argv.indexOf("--limit");
const LIMIT = li > -1 ? Math.max(1, Math.min(15, Number(process.argv[li + 1]) || 10)) : 10;

// Already regenerated on Modal — don't burn credit redoing them.
const SKIP_SLUGS = new Set(["paw-pals-pet-grooming"]);

async function ap<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${AP}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${KEY}`,
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`[autopilot ${res.status}] ${path}: ${(await res.text().catch(() => "")).slice(0, 300)}`);
  return (await res.json()) as T;
}

type Job = { status: string; phase: string; progress: number; result?: { finalVideoPath?: string } & Record<string, unknown>; error?: string };

async function waitForJob(jobId: string): Promise<Job> {
  const deadline = Date.now() + 40 * 60 * 1000;
  let lastPhase = "";
  for (;;) {
    const job = await ap<Job>("GET", `/vater/jobs/${encodeURIComponent(jobId)}`);
    if (job.phase !== lastPhase) {
      console.log(`      phase=${job.phase} ${job.progress}%`);
      lastPhase = job.phase;
    }
    if (job.status === "done") return job;
    if (job.status === "failed") throw new Error(`job failed: ${job.error || "(no msg)"}`);
    if (Date.now() > deadline) throw new Error(`timed out (phase=${job.phase})`);
    await new Promise((r) => setTimeout(r, 12_000));
  }
}

function voiceFor(category: string): string {
  const c = (category || "").toLowerCase();
  if (/(barber|barbecue|bbq|smokehouse)/.test(c)) return "MorganDeep";
  return "CalmFemale";
}

function taglineFor(category: string, city: string): string {
  const c = (category || "").toLowerCase();
  if (/(restaurant|bbq|barbecue|smokehouse|bakery|breakfast|lunch|food|cafe|coffee|grill)/.test(c))
    return "Made with care, and worth the trip.";
  if (/(salon|barber|hair|nail|beauty|spa)/.test(c)) return "Walk out looking and feeling your best.";
  if (/(pet|groom|dog)/.test(c)) return "Gentle, careful grooming your pet will love.";
  if (/(boutique|shop|store|retail|clothing)/.test(c)) return "Pieces you won't find anywhere else.";
  return `A local favorite in ${city}.`;
}

async function main() {
  if (!AP || !KEY) throw new Error("AUTOPILOT_URL / CONTENT_API_KEY not set");
  if (!process.env.BLOB_READ_WRITE_TOKEN) throw new Error("BLOB_READ_WRITE_TOKEN not set");

  const leads = await prisma.growthLead.findMany({
    where: { offer: "video", videoUrl: { not: null } },
    orderBy: { score: "desc" },
    take: LIMIT,
    select: { id: true, name: true, category: true, city: true, rating: true, reviews: true, score: true, videoUrl: true },
  });

  console.log(`Top ${leads.length} video demos → Modal Wan2.2\n`);
  let done = 0, skipped = 0, failed = 0;

  for (const [n, lead] of leads.entries()) {
    const slug = (lead.videoUrl || "").replace(/^\/v\//, "");
    if (!slug) { console.log(`[${n + 1}] ⚠ ${lead.name} — no slug, skip`); failed++; continue; }
    if (SKIP_SLUGS.has(slug)) { console.log(`[${n + 1}] ⏭ ${lead.name} — already Modal, skip`); skipped++; continue; }

    const city = lead.city || "the KC metro";
    const category = (lead.category || "local business").toLowerCase();
    const proof = lead.rating != null && lead.reviews != null && lead.reviews > 0
      ? `Rated ${lead.rating.toFixed(1)} stars by ${lead.reviews} real customers on Google.`
      : `A local team your neighbors in ${city} already trust.`;
    const script = `Looking for ${category} in ${city}? Meet ${lead.name}.\n\n${proof}\n\n${taglineFor(category, city)}\n\nDon't wait — visit ${lead.name} in ${city} today.`;
    const wordCount = script.split(/\s+/).filter(Boolean).length;
    const voice = voiceFor(category);

    console.log(`[${n + 1}/${leads.length}] ▶ ${lead.name} (score ${lead.score}, voice ${voice}) → /v/${slug}`);
    try {
      const { jobId } = await ap<{ jobId: string }>("POST", "/vater/run-creation", {
        projectId: `b2bvideo-demo-${lead.id}`,
        mode: "topic",
        topic: `${lead.name} — 15-second local promo`,
        goal: "Short punchy local-business promo ad",
        targetWordCount: wordCount,
        stylePreset: "cinematic",
        voiceCloneName: voice,
        videoBackend: "sdxl",
        scriptOverride: script,
        style: { defaultAnimMode: "all", animQuality: "modal-wan22" },
      });
      const job = await waitForJob(jobId);
      const localPath = job.result?.finalVideoPath;
      let buffer: Buffer;
      if (localPath && existsSync(localPath)) {
        buffer = readFileSync(localPath);
      } else {
        const res = await fetch(`${AP}/vater/file/${encodeURIComponent(jobId)}/video`, { headers: { Authorization: `Bearer ${KEY}` } });
        if (!res.ok) throw new Error(`download failed ${res.status}`);
        buffer = Buffer.from(await res.arrayBuffer());
      }
      const blob = await put(`b2b-videos/${slug}.mp4`, buffer, {
        access: "public", addRandomSuffix: false, allowOverwrite: true, contentType: "video/mp4",
      });
      await prisma.growthLead.update({ where: { id: lead.id }, data: { videoAssetUrl: blob.url } });
      done++;
      console.log(`      ✓ ${(buffer.length / 1024 / 1024).toFixed(1)} MB → https://www.tolley.io/v/${slug}`);
    } catch (err) {
      failed++;
      console.error(`      ✗ FAILED: ${err instanceof Error ? err.message : err}`);
    }
  }

  console.log("─".repeat(50));
  console.log(`done: ${done} regenerated, ${skipped} skipped, ${failed} failed`);
}

main().catch((e) => { console.error("\n❌", e instanceof Error ? e.message : e); process.exitCode = 1; })
  .finally(async () => { await prisma.$disconnect(); });
