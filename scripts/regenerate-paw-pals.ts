/**
 * One-off: regenerate the Paw Pals Pet Grooming /v/ video as a LEGIT 15s clip
 * via Modal Wan2.2 i2v motion (animQuality=modal-wan22) instead of the old
 * SDXL Ken Burns. Image descriptions (scene prompts) now come from Kimi
 * (autopilot VATER_PLANNER_MODEL=fallback/kimi-k2-turbo). Overwrites the
 * existing blob + updates the lead in place.
 *
 *   npx tsx scripts/regenerate-paw-pals.ts
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
const VOICE = process.env.B2B_VIDEO_VOICE || "CalmFemale";
const SLUG = "paw-pals-pet-grooming";

async function ap<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${AP}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${KEY}`,
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`[autopilot ${res.status}] ${path}: ${(await res.text().catch(() => "")).slice(0, 400)}`);
  return (await res.json()) as T;
}

type Job = {
  status: string;
  phase: string;
  progress: number;
  result?: { finalVideoUrl?: string; finalVideoPath?: string } & Record<string, unknown>;
  error?: string;
};

async function waitForJob(jobId: string): Promise<Job> {
  const deadline = Date.now() + 40 * 60 * 1000;
  let lastPhase = "";
  for (;;) {
    const job = await ap<Job>("GET", `/vater/jobs/${encodeURIComponent(jobId)}`);
    if (job.phase !== lastPhase) {
      console.log(`    phase=${job.phase} progress=${job.progress}%`);
      lastPhase = job.phase;
    }
    if (job.status === "done") return job;
    if (job.status === "failed") throw new Error(`job ${jobId} failed: ${job.error || "(no msg)"}`);
    if (Date.now() > deadline) throw new Error(`job ${jobId} timed out (phase=${job.phase})`);
    await new Promise((r) => setTimeout(r, 12_000));
  }
}

async function main() {
  if (!AP) throw new Error("AUTOPILOT_URL not set");
  if (!KEY) throw new Error("CONTENT_API_KEY not set");
  if (!process.env.BLOB_READ_WRITE_TOKEN) throw new Error("BLOB_READ_WRITE_TOKEN not set");

  const lead = await prisma.growthLead.findFirst({
    where: { videoUrl: `/v/${SLUG}` },
    select: { id: true, name: true, category: true, city: true, rating: true, reviews: true },
  });
  if (!lead) throw new Error(`lead for /v/${SLUG} not found`);

  const city = lead.city || "the KC metro";
  const category = (lead.category || "pet grooming").toLowerCase();
  const proof =
    lead.rating != null && lead.reviews != null && lead.reviews > 0
      ? `Rated ${lead.rating.toFixed(1)} stars by ${lead.reviews} real customers on Google.`
      : `A local team your neighbors in ${city} already trust.`;
  const script = `Looking for ${category} in ${city}? Meet ${lead.name}.\n\n${proof}\n\nGentle, careful grooming for the pets your family loves.\n\nDon't wait — book ${lead.name} in ${city} today.`;
  const wordCount = script.split(/\s+/).filter(Boolean).length;

  console.log(`▶ Regenerating ${lead.name} via Modal Wan2.2 (voice=${VOICE})`);
  console.log(script.split("\n\n").map((l) => `    ${l}`).join("\n"));

  const { jobId } = await ap<{ jobId: string }>("POST", "/vater/run-creation", {
    projectId: `b2bvideo-regen-${lead.id}`,
    mode: "topic",
    topic: `${lead.name} — 15-second local promo`,
    goal: "Short punchy local-business promo ad",
    targetWordCount: wordCount,
    stylePreset: "cinematic",
    voiceCloneName: VOICE,
    videoBackend: "sdxl",
    scriptOverride: script,
    // SDXL stills animated by Modal Wan2.2 i2v. defaultAnimMode="all" turns the
    // Step 7c animation stage ON (default is "none"=skip); animQuality picks Modal.
    style: { defaultAnimMode: "all", animQuality: "modal-wan22" },
  });
  console.log(`    autopilot job ${jobId}`);

  const job = await waitForJob(jobId);
  const localPath = job.result?.finalVideoPath;
  let buffer: Buffer;
  if (localPath && existsSync(localPath)) {
    buffer = readFileSync(localPath);
  } else {
    const res = await fetch(`${AP}/vater/file/${encodeURIComponent(jobId)}/video`, {
      headers: { Authorization: `Bearer ${KEY}` },
    });
    if (!res.ok) throw new Error(`download failed: ${res.status}`);
    buffer = Buffer.from(await res.arrayBuffer());
  }
  console.log(`    final.mp4 = ${(buffer.length / 1024 / 1024).toFixed(1)} MB`);

  const blob = await put(`b2b-videos/${SLUG}.mp4`, buffer, {
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "video/mp4",
  });
  console.log(`    blob → ${blob.url}`);

  await prisma.growthLead.update({
    where: { id: lead.id },
    data: { videoAssetUrl: blob.url },
  });
  console.log(`  ✓ DONE → https://www.tolley.io/v/${SLUG}`);
}

main()
  .catch((err) => {
    console.error("\n❌", err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
