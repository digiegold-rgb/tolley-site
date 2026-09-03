/**
 * scripts/vater-poster-sweep.ts — DGX-only. Permanent tile posters.
 *
 * For every YouTubeProject whose final mp4 lives on public Vercel Blob and
 * has no poster (or a poster cut from an older final version), pull one
 * frame with ffmpeg, upload it to vater-posters/<id>.jpg and store the URL
 * (pinned to the final's version tag) in YouTubeProject.posterUrl.
 *
 *   npx tsx scripts/vater-poster-sweep.ts [--limit N] [--concurrency N] [--dry-run] [--id <projectId>]
 *
 * Runs every 3 minutes from vater-poster-sweep.timer (~/bin/vater-poster-sweep.sh)
 * so a freshly composed video gets its poster within minutes of landing.
 * Idempotent: a project whose poster matches the final's version is skipped.
 *
 * Needs DATABASE_URL + BLOB_READ_WRITE_TOKEN (loaded from .env.local).
 * ffmpeg/ffprobe read the mp4 straight from the blob URL — nothing is
 * downloaded to disk except the one JPEG in tmpdir.
 */
import { put } from "@vercel/blob";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { prisma } from "../lib/prisma";
import {
  posterBlobKey,
  posterFrameTime,
  posterNeedsRefresh,
  posterScaleFilter,
  posterUrlFor,
} from "../lib/vater/poster";

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

function arg(name: string): string | null {
  const i = process.argv.indexOf(name);
  return i > -1 ? (process.argv[i + 1] ?? null) : null;
}
const DRY = process.argv.includes("--dry-run");
const LIMIT = Number(arg("--limit") ?? 500);
const CONCURRENCY = Math.max(1, Number(arg("--concurrency") ?? 4));
const ONLY_ID = arg("--id");

function probeDuration(url: string): number | null {
  const r = spawnSync(
    "ffprobe",
    ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", url],
    { encoding: "utf8", timeout: 60_000 },
  );
  const n = Number(String(r.stdout).trim());
  return r.status === 0 && Number.isFinite(n) && n > 0 ? n : null;
}

function extractFrame(url: string, at: number, out: string): void {
  const r = spawnSync(
    "ffmpeg",
    [
      "-hide_banner", "-loglevel", "error", "-y",
      "-ss", at.toFixed(2),
      "-i", url,
      "-frames:v", "1",
      "-vf", posterScaleFilter(),
      "-q:v", "4",
      out,
    ],
    { encoding: "utf8", timeout: 120_000 },
  );
  if (r.status !== 0 || !existsSync(out)) {
    throw new Error(`ffmpeg failed (${r.status}): ${String(r.stderr).slice(-300)}`);
  }
}

async function makePoster(row: { id: string; finalVideoUrl: string }): Promise<string> {
  const duration = probeDuration(row.finalVideoUrl);
  const at = posterFrameTime(duration);
  const tmp = join(tmpdir(), `vater-poster-${row.id}-${process.pid}.jpg`);
  try {
    extractFrame(row.finalVideoUrl, at, tmp);
    const body = readFileSync(tmp);
    if (body.length < 2_000) throw new Error(`poster too small (${body.length}B) — black/blank frame?`);
    const blob = await put(posterBlobKey(row.id), body, {
      access: "public",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "image/jpeg",
      cacheControlMaxAge: 31_536_000,
    });
    return posterUrlFor(blob.url, row.finalVideoUrl);
  } finally {
    if (existsSync(tmp)) unlinkSync(tmp);
  }
}

async function main() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) throw new Error("BLOB_READ_WRITE_TOKEN missing");
  const rows = await prisma.youTubeProject.findMany({
    where: ONLY_ID ? { id: ONLY_ID } : { finalVideoUrl: { not: null } },
    select: { id: true, finalVideoUrl: true, posterUrl: true, updatedAt: true },
    orderBy: { updatedAt: "desc" },
  });
  const needing = rows.filter((r) =>
    posterNeedsRefresh({ finalVideoUrl: r.finalVideoUrl, posterUrl: r.posterUrl }),
  );
  const needAll = needing.length;
  const todo = needing.slice(0, LIMIT) as Array<{ id: string; finalVideoUrl: string; posterUrl: string | null }>;
  console.log(`[poster-sweep] finals=${rows.length} need=${needAll} taking=${todo.length} dry=${DRY} concurrency=${CONCURRENCY}`);
  if (todo.length === 0) return;

  let ok = 0, failed = 0, next = 0;
  const t0 = Date.now();
  async function worker() {
    while (next < todo.length) {
      const row = todo[next++];
      try {
        if (DRY) { console.log(`[dry-run] ${row.id} ${row.finalVideoUrl}`); ok++; continue; }
        const posterUrl = await makePoster(row);
        await prisma.youTubeProject.update({ where: { id: row.id }, data: { posterUrl } });
        ok++;
        console.log(`[ok] ${row.id} → ${posterUrl}`);
      } catch (err) {
        failed++;
        console.error(`[fail] ${row.id}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, todo.length) }, worker));
  console.log(`[poster-sweep] done ok=${ok} failed=${failed} in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  if (failed > 0 && ok === 0) process.exitCode = 1;
}

main()
  .catch((err) => { console.error(err); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
