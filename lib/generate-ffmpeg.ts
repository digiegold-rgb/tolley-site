/**
 * Vercel-side ffmpeg for /generate Motion: 0.5× remux + concat stitch.
 *
 * Uses the `ffmpeg` binary on PATH (or FFMPEG_PATH). This is Vercel Node —
 * not Spark. If ffmpeg is missing, callers must fall back (playbackRate for
 * slow-mo; stitch returns a clear error).
 */

import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

export const SLOW_MO_RATE = 0.5;
export const SLOW_MO_SETPTS = 2; // 1 / 0.5

export function ffmpegBin(env: NodeJS.ProcessEnv = process.env): string {
  return (env.FFMPEG_PATH || env.FFMPEG || "ffmpeg").trim() || "ffmpeg";
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
    return { ok: false, bin, error: err instanceof Error ? err.message : String(err) };
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
