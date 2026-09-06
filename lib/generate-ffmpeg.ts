/**
 * Vercel-side ffmpeg for /generate Motion: 0.5× remux, concat stitch, and
 * Motion 2 last-frame extract.
 *
 * Vercel Node has no system ffmpeg. Remux, stitch, and extract share one
 * resolver — do not spawn a bare `ffmpeg` first:
 *   FFMPEG_PATH → FFMPEG → require("ffmpeg-static") → PATH `ffmpeg`
 *
 * A missing env path is skipped. Do not rely on a Vercel env pointing at a
 * nonexistent binary. ffmpeg-static is a dependency and is file-traced into
 * the generate serverless functions.
 *
 * If the binary is still missing after that, remux callers may fall back
 * (playbackRate for slow-mo); stitch and last-frame extract error clearly.
 */

import { spawn } from "node:child_process";
import { chmodSync, existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ffmpegStatic from "ffmpeg-static";

export const SLOW_MO_RATE = 0.5;
export const SLOW_MO_SETPTS = 2; // 1 / 0.5

const PATH_FALLBACK = "ffmpeg";

function skipFallbacks(env: NodeJS.ProcessEnv): boolean {
  const v = (env.FFMPEG_SKIP_FALLBACKS || "").trim().toLowerCase();
  return v === "1" || v === "true";
}

function ensureExecutable(bin: string): void {
  if (bin === PATH_FALLBACK || bin === "ffmpeg.exe") return;
  try {
    chmodSync(bin, 0o755);
  } catch {
    /* spawn reports the real error */
  }
}

function usableFile(bin: string | undefined | null): string | undefined {
  const p = (bin || "").trim();
  if (!p || p === PATH_FALLBACK || p === "ffmpeg.exe") return undefined;
  if (!existsSync(p)) return undefined;
  ensureExecutable(p);
  return p;
}

/** require("ffmpeg-static") — import keeps Next from stripping the package. */
function ffmpegStaticBin(): string | undefined {
  const fromImport = usableFile(typeof ffmpegStatic === "string" ? ffmpegStatic : null);
  if (fromImport) return fromImport;
  try {
    const req = createRequire(import.meta.url);
    const loaded = req("ffmpeg-static") as unknown;
    const fromRequire = usableFile(typeof loaded === "string" ? loaded : null);
    if (fromRequire) return fromRequire;
  } catch {
    /* webpack chunk path — fall through to traced cwd copy */
  }
  try {
    const req = createRequire(join(process.cwd(), "package.json"));
    const loaded = req("ffmpeg-static") as unknown;
    const fromCwd = usableFile(typeof loaded === "string" ? loaded : null);
    if (fromCwd) return fromCwd;
  } catch {
    /* not in this bundle */
  }
  return usableFile(join(process.cwd(), "node_modules", "ffmpeg-static", "ffmpeg"));
}

/**
 * Shared by remux, stitch, and last-frame extract.
 * FFMPEG_PATH → FFMPEG → require("ffmpeg-static") → `ffmpeg`.
 * Nonexistent env paths are skipped so a stale Vercel env cannot cause ENOENT.
 */
export function ffmpegBin(env: NodeJS.ProcessEnv = process.env): string {
  if (skipFallbacks(env)) {
    return (env.FFMPEG_PATH || env.FFMPEG || PATH_FALLBACK).trim() || PATH_FALLBACK;
  }
  const fromPath = usableFile(env.FFMPEG_PATH);
  if (fromPath) return fromPath;
  const fromFfmpeg = usableFile(env.FFMPEG);
  if (fromFfmpeg) return fromFfmpeg;
  const fromStatic = ffmpegStaticBin();
  if (fromStatic) return fromStatic;
  return PATH_FALLBACK;
}

/** Same resolver as ffmpegBin — remux / stitch / extract all go through here. */
export function resolveFfmpegPath(env: NodeJS.ProcessEnv = process.env): string {
  return ffmpegBin(env);
}

export async function isFfmpegAvailable(
  env: NodeJS.ProcessEnv = process.env,
): Promise<{ ok: boolean; bin: string; error?: string }> {
  const bin = ffmpegBin(env);
  try {
    const { code, stderr } = await run(bin, ["-version"], { timeoutMs: 8_000 });
    if (code === 0) return { ok: true, bin };
    return { ok: false, bin, error: stderr.slice(0, 240) || `ffmpeg exited ${code}` };
  } catch (err) {
    return {
      ok: false,
      bin,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export function slowMoLabel(slowMo: boolean): string {
  return slowMo ? "0.5× slow-mo" : "1×";
}

/** Playback rate for the in-page player when the file was not remuxed. */
export function playbackRateForSlowMo(slowMo: boolean, remuxed: boolean): number {
  if (slowMo && !remuxed) return SLOW_MO_RATE;
  return 1;
}

async function run(
  bin: string,
  args: string[],
  opts?: { timeoutMs?: number },
): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`ffmpeg timed out after ${opts?.timeoutMs || 60_000}ms`));
    }, opts?.timeoutMs || 60_000);
    child.stdout.on("data", (d: Buffer) => {
      stdout += d.toString("utf8");
    });
    child.stderr.on("data", (d: Buffer) => {
      stderr += d.toString("utf8");
    });
    child.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code: code ?? 1, stdout, stderr });
    });
  });
}

async function withTempDir<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), "gen-ff-"));
  try {
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/**
 * Remux / re-encode so wall-clock duration is 2× (0.5× play).
 * Video-only (Wan clips have no speech we need). Falls back to throw.
 */
export async function remuxSlowMo(
  input: Buffer,
  env: NodeJS.ProcessEnv = process.env,
): Promise<Buffer> {
  const avail = await isFfmpegAvailable(env);
  if (!avail.ok) {
    throw new Error(`ffmpeg not available for 0.5× remux (${avail.error || "not on PATH"})`);
  }
  return withTempDir(async (dir) => {
    const src = join(dir, "in.mp4");
    const dest = join(dir, "out.mp4");
    await writeFile(src, input);
    const { code, stderr } = await run(
      avail.bin,
      [
        "-y",
        "-i",
        src,
        "-filter:v",
        `setpts=${SLOW_MO_SETPTS}*PTS`,
        "-an",
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-crf",
        "20",
        "-movflags",
        "+faststart",
        dest,
      ],
      { timeoutMs: 90_000 },
    );
    if (code !== 0) {
      throw new Error(`ffmpeg slow-mo remux failed: ${stderr.slice(-400)}`);
    }
    const out = await readFile(dest);
    if (!out.length) throw new Error("ffmpeg slow-mo produced an empty file");
    return out;
  });
}

/**
 * Last video frame of an MP4 as a PNG. Used by Motion 2 to chain beat k → k+1
 * (`source_image_url` of the next Wan I2V call). Motion 1 does not use this.
 */
export async function extractLastFrame(
  input: Buffer,
  env: NodeJS.ProcessEnv = process.env,
): Promise<Buffer> {
  if (!input.length) throw new Error("Need an MP4 to extract the last frame");
  const avail = await isFfmpegAvailable(env);
  if (!avail.ok) {
    throw new Error(
      `ffmpeg not available for last-frame extract (${avail.error || "not on PATH"}). Motion 2 continuity needs ffmpeg on this runtime.`,
    );
  }
  return withTempDir(async (dir) => {
    const src = join(dir, "in.mp4");
    const dest = join(dir, "last.png");
    await writeFile(src, input);
    const attempts: string[][] = [
      ["-y", "-sseof", "-0.05", "-i", src, "-frames:v", "1", "-update", "1", dest],
      ["-y", "-sseof", "-0.2", "-i", src, "-frames:v", "1", "-update", "1", dest],
      ["-y", "-i", src, "-vf", "select='eq(n\\,N-1)'", "-vsync", "vfr", "-frames:v", "1", dest],
    ];
    let lastErr = "";
    for (let i = 0; i < attempts.length; i++) {
      const { code, stderr } = await run(avail.bin, attempts[i], { timeoutMs: 30_000 });
      if (code === 0) {
        try {
          const out = await readFile(dest);
          if (out.length >= 8 && out[0] === 0x89 && out[1] === 0x50) return out;
        } catch {
          /* try next */
        }
      }
      lastErr = stderr.slice(-400);
      if (i === attempts.length - 1) {
        throw new Error(`ffmpeg last-frame extract failed: ${lastErr || `exited ${code}`}`);
      }
    }
    throw new Error(`ffmpeg last-frame extract failed: ${lastErr}`);
  });
}

/**
 * Concat many already-encoded H.264 clips via the concat demuxer (stream copy).
 * This is the Motion 2 stitch path — 36×5s clips would blow Vercel 120s if we
 * re-encoded. Motion 1 keeps concatMp4s (re-encode) for mixed slow-mo files.
 */
export async function concatMp4sCopy(
  clips: Buffer[],
  env: NodeJS.ProcessEnv = process.env,
): Promise<Buffer> {
  if (clips.length < 1) throw new Error("Need at least one clip to stitch");
  if (clips.length === 1) return clips[0];
  const avail = await isFfmpegAvailable(env);
  if (!avail.ok) {
    throw new Error(
      `ffmpeg not available for longform stitch on this runtime (${avail.error || "not on PATH"}). Motion 2 stitch is Vercel Node concat-demuxer (stream copy), not Spark.`,
    );
  }
  return withTempDir(async (dir) => {
    const listPath = join(dir, "list.txt");
    const dest = join(dir, "out.mp4");
    const lines: string[] = [];
    for (let i = 0; i < clips.length; i++) {
      const p = join(dir, `c${i}.mp4`);
      await writeFile(p, clips[i]);
      lines.push(`file '${p.replace(/'/g, "'\\''")}'`);
    }
    await writeFile(listPath, lines.join("\n") + "\n");
    const { code, stderr } = await run(
      avail.bin,
      ["-y", "-f", "concat", "-safe", "0", "-i", listPath, "-c", "copy", "-movflags", "+faststart", dest],
      { timeoutMs: 110_000 },
    );
    if (code !== 0) {
      throw new Error(
        `ffmpeg concat-demuxer (stream copy) failed: ${stderr.slice(-400)}. Re-encode concat is Motion 1 only — 36 clips would exceed Vercel 120s.`,
      );
    }
    const out = await readFile(dest);
    if (!out.length) throw new Error("ffmpeg longform stitch produced an empty file");
    return out;
  });
}

/**
 * Simple concat (no crossfade). Clips are re-encoded to one H.264 stream so
 * mixed Wan I2V / remuxed slow-mo files stitch cleanly.
 */
export async function concatMp4s(
  clips: Buffer[],
  opts?: { crossfadeSec?: number },
  env: NodeJS.ProcessEnv = process.env,
): Promise<Buffer> {
  if (clips.length < 1) throw new Error("Need at least one clip to stitch");
  if (clips.length === 1) return clips[0];
  const avail = await isFfmpegAvailable(env);
  if (!avail.ok) {
    throw new Error(
      `ffmpeg not available for stitch on this runtime (${avail.error || "not on PATH"}). Stitch runs on Vercel Node, not Spark.`,
    );
  }
  const fade = opts?.crossfadeSec && opts.crossfadeSec > 0 ? opts.crossfadeSec : 0;
  return withTempDir(async (dir) => {
    const paths: string[] = [];
    for (let i = 0; i < clips.length; i++) {
      const p = join(dir, `c${i}.mp4`);
      await writeFile(p, clips[i]);
      paths.push(p);
    }
    const dest = join(dir, "out.mp4");
    const args = fade > 0 && clips.length === 2
      ? xfadeArgs(paths, dest, fade)
      : concatCopyArgs(paths, dest);
    const { code, stderr } = await run(avail.bin, args, { timeoutMs: 120_000 });
    if (code !== 0) {
      throw new Error(`ffmpeg stitch failed: ${stderr.slice(-400)}`);
    }
    const out = await readFile(dest);
    if (!out.length) throw new Error("ffmpeg stitch produced an empty file");
    return out;
  });
}

function concatCopyArgs(paths: string[], dest: string): string[] {
  const inputs = paths.flatMap((p) => ["-i", p]);
  const n = paths.length;
  const concat = paths.map((_, i) => `[${i}:v:0]`).join("") + `concat=n=${n}:v=1:a=0[v]`;
  return [
    "-y",
    ...inputs,
    "-filter_complex",
    concat,
    "-map",
    "[v]",
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-crf",
    "20",
    "-movflags",
    "+faststart",
    dest,
  ];
}

function xfadeArgs(paths: string[], dest: string, fadeSec: number): string[] {
  // Two-clip fade only (easy path). Offset is applied after the first clip;
  // callers who want fade on N>2 should concat first.
  return [
    "-y",
    "-i",
    paths[0],
    "-i",
    paths[1],
    "-filter_complex",
    `[0:v][1:v]xfade=transition=fade:duration=${fadeSec}:offset=4[v]`,
    "-map",
    "[v]",
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-crf",
    "20",
    "-movflags",
    "+faststart",
    dest,
  ];
}
