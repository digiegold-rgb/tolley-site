/**
 * Upload vater final MP4s to Vercel Blob so the Library plays from the CDN
 * instead of proxying DGX bytes through the Cloudflare tunnel + serverless
 * (which truncates on slow external links — audio plays, video starves).
 *
 * Single upload (called by vater.py on render completion; no DB write —
 * the job result carries the URL and the poll route persists it):
 *   npx tsx scripts/vater-blob-upload.ts --file /path/to/final.mp4 --project <projectId>
 *
 * Backfill all ready projects still pointing at the DGX proxy path:
 *   npx tsx scripts/vater-blob-upload.ts --backfill [--limit N] [--dry-run]
 *
 * Arbitrary asset at an explicit Blob pathname (Listing Studio stills, MLS
 * .txt, thumbnails — content-autopilot/vater_listing.py):
 *   npx tsx scripts/vater-blob-upload.ts --file /path/x.png --key listing/<id>/staged.png [--content-type image/png]
 *   --content-type defaults from the extension (png/jpg/jpeg/webp/txt/mp4);
 *   mp4s still get the faststart remux, everything else uploads verbatim.
 *
 * Every upload is remuxed with `-movflags +faststart` first (idempotent,
 * stream-copy) — pre-Aug-7 renders have moov at the end of the file.
 */
import { PrismaClient } from "@prisma/client";
import { put } from "@vercel/blob";
import { spawnSync } from "child_process";
import { existsSync, readFileSync, unlinkSync } from "fs";
import { tmpdir } from "os";
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

const VATER_WORK = "/home/jelly/content-autopilot/vater_work";

function arg(name: string): string | null {
  const i = process.argv.indexOf(name);
  return i > -1 ? process.argv[i + 1] ?? null : null;
}
const has = (name: string) => process.argv.includes(name);

async function uploadOne(filePath: string, projectId: string): Promise<string> {
  if (!existsSync(filePath)) throw new Error(`missing file: ${filePath}`);
  const tmp = join(tmpdir(), `vater-faststart-${projectId}-${process.pid}.mp4`);
  const ff = spawnSync(
    "ffmpeg",
    ["-y", "-i", filePath, "-c", "copy", "-movflags", "+faststart", tmp],
    { stdio: ["ignore", "ignore", "pipe"], timeout: 300_000 },
  );
  if (ff.status !== 0 || !existsSync(tmp)) {
    throw new Error(
      `faststart remux failed (${ff.status}): ${String(ff.stderr).slice(-300)}`,
    );
  }
  try {
    const blob = await put(`vater-finals/${projectId}.mp4`, readFileSync(tmp), {
      access: "public",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "video/mp4",
    });
    // Version query busts browser caches when a re-compose overwrites the
    // same pathname (Blob's edge cache purges on overwrite; browsers don't).
    return `${blob.url}?v=${Date.now()}`;
  } finally {
    try { unlinkSync(tmp); } catch { /* tmp cleanup best-effort */ }
  }
}

const CONTENT_TYPES: Record<string, string> = {
  mp4: "video/mp4",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  txt: "text/plain; charset=utf-8",
  json: "application/json",
};

/** Upload any file to an explicit Blob pathname. mp4 → faststart remux first. */
async function uploadKey(filePath: string, key: string, contentType?: string | null): Promise<string> {
  if (!existsSync(filePath)) throw new Error(`missing file: ${filePath}`);
  const ext = (filePath.split(".").pop() ?? "").toLowerCase();
  const ct = contentType || CONTENT_TYPES[ext] || "application/octet-stream";
  let body = readFileSync(filePath);
  let tmp: string | null = null;
  if (ext === "mp4") {
    tmp = join(tmpdir(), `vater-faststart-${process.pid}-${Date.now()}.mp4`);
    const ff = spawnSync(
      "ffmpeg",
      ["-y", "-i", filePath, "-c", "copy", "-movflags", "+faststart", tmp],
      { stdio: ["ignore", "ignore", "pipe"], timeout: 300_000 },
    );
    if (ff.status !== 0 || !existsSync(tmp)) {
      throw new Error(`faststart remux failed (${ff.status}): ${String(ff.stderr).slice(-300)}`);
    }
    body = readFileSync(tmp);
  }
  try {
    const blob = await put(key.replace(/^\/+/, ""), body, {
      access: "public",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: ct,
    });
    return `${blob.url}?v=${Date.now()}`;
  } finally {
    if (tmp) { try { unlinkSync(tmp); } catch { /* tmp cleanup best-effort */ } }
  }
}

async function backfill() {
  const prisma = new PrismaClient();
  const limit = Number(arg("--limit")) || undefined;
  const dryRun = has("--dry-run");
  const rows = await prisma.youTubeProject.findMany({
    where: {
      status: "ready",
      NOT: { finalVideoUrl: { startsWith: "https://" } },
    },
    select: { id: true, finalVideoUrl: true, autopilotJobId: true },
    orderBy: { updatedAt: "desc" },
    ...(limit ? { take: limit } : {}),
  });
  console.log(`${rows.length} ready project(s) without a blob URL`);
  let ok = 0, missing = 0, failed = 0;
  for (const row of rows) {
    const m = row.finalVideoUrl?.match(/\/vater\/file\/([^/]+)\/video/);
    const jobId = m?.[1] || row.autopilotJobId;
    const file = jobId ? join(VATER_WORK, jobId, "final.mp4") : null;
    if (!file || !existsSync(file)) {
      console.log(`  SKIP ${row.id} — no final.mp4 on disk (job ${jobId ?? "?"})`);
      missing++;
      continue;
    }
    if (dryRun) {
      console.log(`  DRY  ${row.id} ← ${file}`);
      ok++;
      continue;
    }
    try {
      const url = await uploadOne(file, row.id);
      await prisma.youTubeProject.update({
        where: { id: row.id },
        data: { finalVideoUrl: url },
      });
      console.log(`  OK   ${row.id} → ${url}`);
      ok++;
    } catch (err) {
      console.log(`  FAIL ${row.id} — ${err instanceof Error ? err.message : err}`);
      failed++;
    }
  }
  console.log(`done: ${ok} uploaded, ${missing} missing on disk, ${failed} failed${dryRun ? " (dry run)" : ""}`);
  await prisma.$disconnect();
  if (failed > 0) process.exitCode = 1;
}

async function main() {
  if (has("--backfill")) return backfill();
  const file = arg("--file");
  const key = arg("--key");
  if (file && key) {
    const url = await uploadKey(file, key, arg("--content-type"));
    console.log(JSON.stringify({ url }));
    return;
  }
  const project = arg("--project");
  if (!file || !project) {
    console.error(
      "usage: --file <final.mp4> --project <projectId> | --file <path> --key <blob/pathname> [--content-type <mime>] | --backfill [--limit N] [--dry-run]",
    );
    process.exit(2);
  }
  const url = await uploadOne(file, project);
  console.log(JSON.stringify({ url }));
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
