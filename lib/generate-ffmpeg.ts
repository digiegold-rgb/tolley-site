/**
 * Vercel-side ffmpeg for /generate Motion: 0.5× remux + concat stitch +
 * Motion 2 last-frame extract.
 *
 * One resolver for remux, stitch, and last-frame extract. Do not spawn a
 * bare `ffmpeg` until every fallback has been tried — Vercel Node has no
 * system ffmpeg (spawn ffmpeg ENOENT). Order:
 *   1. FFMPEG_PATH / FFMPEG (when the file exists)
 *   2. @ffmpeg-installer/ffmpeg
 *   3. ffmpeg-static
 *   4. vendored bin/ffmpeg or vendor/ffmpeg under cwd
 *   5. `ffmpeg` on PATH
 *
 * If ffmpeg is still missing after that, remux callers may fall back
 * (playbackRate for slow-mo); stitch and last-frame extract error clearly.
 */

import { spawn } from "node:child_process";
import { chmodSync, existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

export const SLOW_MO_RATE = 0.5;
export const SLOW_MO_SETPTS = 2; // 1 / 0.5

const PATH_FALLBACK = "ffmpeg";

function skipFallbacks(env: NodeJS.ProcessEnv): boolean {
  const v = (env.FFMPEG_SKIP_FALLBACKS || "").trim().toLowerCase();
  return v === "1" || v === "true";
}

function envBins(env: NodeJS.ProcessEnv): string[] {
  const out: string[] = [];
  for (const key of ["FFMPEG_PATH", "FFMPEG"] as const) {
    const raw = (env[key] || "").trim();
    if (raw && !out.includes(raw)) out.push(raw);
  }
  return out;
}

function ensureExecutable(bin: string): void {
  if (bin === PATH_FALLBACK || bin === "ffmpeg.exe") return;
  try {
    chmodSync(bin, 0o755);
  } catch {
    /* spawn reports the real error */
  }
}

function isPathLookup(bin: string): boolean {
  return bin === PATH_FALLBACK || bin === "ffmpeg.exe";
}

function packageBin(pkg: string, pick: (mod: unknown) => string | undefined): string | undefined {
  try {
    // Resolve from the project root, not a webpack chunk path. Vercel copies
    // ffmpeg-static into the function via outputFileTracingIncludes.
    const req = createRequire(join(process.cwd(), "package.json"));
    const mod = req(pkg);
    const p = pick(mod);
    if (typeof p === "string" && p.trim()) return p.trim();
  } catch {
    /* not installed or not in this serverless bundle */
  }
  return undefined;
}

function installerBin(): string | undefined {
  return packageBin("@ffmpeg-installer/ffmpeg", (mod) => {
    if (mod && typeof mod === "object" && "path" in mod) {
      const p = (mod as { path?: unknown }).path;
      return typeof p === "string" ? p : undefined;
    }
    return undefined;
  });
}

function staticBin(): string | undefined {
  return packageBin("ffmpeg-static", (mod) => {
    if (typeof mod === "string") return mod;
    if (mod && typeof mod === "object" && "default" in mod) {
      const p = (mod as { default?: unknown }).default;
      return typeof p === "string" ? p : undefined;
    }
    return undefined;
  });
}

function vendoredBins(): string[] {
  const cwd = process.cwd();
  return [
    join(cwd, "bin", "ffmpeg"),
    join(cwd, "vendor", "ffmpeg"),
    join(cwd, "node_modules", "ffmpeg-static", "ffmpeg"),
    join(cwd, "node_modules", "@ffmpeg-installer", "linux-x64", "ffmpeg"),
    join(cwd, "node_modules", "@ffmpeg-installer", "ffmpeg", "ffmpeg"),
  ];
}

/** Ordered unique candidates. Last entry is the PATH name `ffmpeg`. */
export function ffmpegCandidates(env: NodeJS.ProcessEnv = process.env): string[] {
  const out: string[] = [];
  const add = (p: string | undefined) => {
    if (p && !out.includes(p)) out.push(p);
  };
  for (const p of envBins(env)) add(p);
  if (skipFallbacks(env)) return out.length ? out : [PATH_FALLBACK];
  add(installerBin());
  add(staticBin());
  for (const p of vendoredBins()) add(p);
  add(PATH_FALLBACK);
  return out;
}

/**
 * First ffmpeg we can point at. Env wins when that file exists; otherwise
 * installer / static / vendored / PATH. Shared by remux, stitch, extract.
 */
export function resolveFfmpegPath(env: NodeJS.ProcessEnv = process.env): string {
  const candidates = ffmpegCandidates(env);
  for (const bin of candidates) {
    if (isPathLookup(bin)) return bin;
    if (existsSync(bin)) {
      ensureExecutable(bin);
      return bin;
    }
  }
  return candidates[0] || PATH_FALLBACK;
}

/** Alias — same resolver as remux / stitch / last-frame extract. */
export function ffmpegBin(env: NodeJS.ProcessEnv = process.env): string {
  return resolveFfmpegPath(env);
}

export async function isFfmpegAvailable(
  env: NodeJS.ProcessEnv = process.env,
): Promise<{ ok: boolean; bin: string; error?: string }> {
  const candidates = ffmpegCandidates(env);
  const errors: string[] = [];
  for (const bin of candidates) {
    if (!isPathLookup(bin) && !existsSync(bin)) {
      errors.push(`${bin}: missing`);
      continue;
    }
    if (!isPathLookup(bin)) ensureExecutable(bin);
    try {
      const { code, stderr } = await run(bin, ["-version"], { timeoutMs: 8_000 });
      if (code === 0) return { ok: true, bin };
      errors.push(`${bin}: ${stderr.slice(0, 160) || `exited ${code}`}`);
    } catch (err) {
      errors.push(`${bin}: ${err instanceof Error ? err.message : String(err)}`);
    }
    if (skipFallbacks(env)) break;
  }
  return {
    ok: false,
    bin: resolveFfmpegPath(env),
    error:
      errors.slice(0, 6).join("; ").slice(0, 400) ||
      "no ffmpeg binary after FFMPEG_PATH, @ffmpeg-installer/ffmpeg, ffmpeg-static, and PATH",
  };
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
