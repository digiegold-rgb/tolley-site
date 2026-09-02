/**
 * Write a permanent card still once, then reuse it.
 *
 * Sources, cheapest first — never POST /vater/thumbnail (paid GPU):
 *   1. Already persisted blob / disk file
 *   2. Designed thumbnailUrl (image only)
 *   3. First scene still (already on the DGX / proxy)
 *   4. Listing staged still
 *   5. One ffmpeg frame from the finished mp4 (local CPU, no GPU)
 *
 * The <img> src is always /api/vater/.../still. This module only fills
 * the bytes behind that path.
 */

import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { put, list } from "@vercel/blob";

import { prisma } from "@/lib/prisma";
import { autopilot } from "@/lib/vater/autopilot-client";
import { firstScenePreviewUrl } from "@/lib/vater/library-card-preview";
import { restFrameTime } from "@/lib/vater/lazy-blob-video";
import {
  classifyStillSource,
  isFragileThumbUrl,
  isPermanentStillPath,
  pickExistingStillSource,
  stillBlobKey,
  type PermanentStillKind,
} from "@/lib/vater/permanent-still";

export interface StillBytes {
  bytes: Buffer;
  contentType: string;
  source: ReturnType<typeof classifyStillSource>;
}

const DISK_DIR = join(tmpdir(), "animate-stills");
const FETCH_MS = 20_000;
const FFMPEG_MS = 25_000;

function diskPath(kind: PermanentStillKind, id: string): string {
  return join(DISK_DIR, `${kind}-${id}.jpg`);
}

function looksLikeImage(contentType: string | null, bytes: Buffer): boolean {
  const ct = (contentType || "").toLowerCase();
  if (ct.startsWith("image/")) return true;
  if (ct.includes("octet-stream") || !ct) {
    return (
      bytes.length > 16 &&
      (bytes[0] === 0xff || bytes[0] === 0x89 || bytes.toString("utf8", 0, 4) === "RIFF")
    );
  }
  return false;
}

async function fetchImageBytes(url: string): Promise<StillBytes | null> {
  if (isFragileThumbUrl(url) || isPermanentStillPath(url)) return null;
  if (!/^https?:\/\//i.test(url)) return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_MS) });
    if (!res.ok) return null;
    const bytes = Buffer.from(await res.arrayBuffer());
    const contentType = res.headers.get("content-type") || "image/jpeg";
    if (!looksLikeImage(contentType, bytes)) return null;
    return { bytes, contentType: contentType.startsWith("image/") ? contentType : "image/jpeg", source: "thumbnail" };
  } catch {
    return null;
  }
}

async function fetchAutopilotImage(jobId: string, kind: string): Promise<StillBytes | null> {
  try {
    const upstream = await autopilot.fetchFile(jobId, kind);
    if (!upstream.ok) return null;
    const bytes = Buffer.from(await upstream.arrayBuffer());
    const contentType = upstream.headers.get("content-type") || "image/jpeg";
    if (!looksLikeImage(contentType, bytes)) return null;
    return {
      bytes,
      contentType: contentType.startsWith("image/") ? contentType : "image/jpeg",
      source: "scene",
    };
  } catch {
    return null;
  }
}

function extractFrame(videoUrl: string): StillBytes | null {
  if (!videoUrl) return null;
  if (videoUrl.startsWith("blob:")) return null;
  if (!/^https?:\/\//i.test(videoUrl) && !existsSync(videoUrl)) return null;
  const out = join(tmpdir(), `animate-still-frame-${process.pid}-${Date.now()}.jpg`);
  const ss = String(restFrameTime(6));
  const ff = spawnSync(
    "ffmpeg",
    [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-ss",
      ss,
      "-i",
      videoUrl,
      "-frames:v",
      "1",
      "-q:v",
      "3",
      "-vf",
      "scale=640:-2",
      out,
    ],
    { timeout: FFMPEG_MS, encoding: "utf8" },
  );
  if (ff.status !== 0 || !existsSync(out)) return null;
  try {
    const bytes = readFileSync(out);
    if (bytes.length < 32) return null;
    return { bytes, contentType: "image/jpeg", source: "frame" };
  } finally {
    try {
      unlinkSync(out);
    } catch {
      /* best-effort */
    }
  }
}

export async function readPersistedStill(
  kind: PermanentStillKind,
  id: string,
): Promise<StillBytes | null> {
  const local = diskPath(kind, id);
  if (existsSync(local)) {
    const bytes = readFileSync(local);
    if (bytes.length > 32) {
      return { bytes, contentType: "image/jpeg", source: "persisted" };
    }
  }
  if (!process.env.BLOB_READ_WRITE_TOKEN) return null;
  try {
    const { blobs } = await list({ prefix: stillBlobKey(kind, id), limit: 1 });
    const hit = blobs[0];
    if (!hit?.url) return null;
    const res = await fetch(hit.url, { signal: AbortSignal.timeout(FETCH_MS) });
    if (!res.ok) return null;
    const bytes = Buffer.from(await res.arrayBuffer());
    if (bytes.length < 32) return null;
    return {
      bytes,
      contentType: res.headers.get("content-type") || "image/jpeg",
      source: "persisted",
    };
  } catch {
    return null;
  }
}

export async function writePersistedStill(
  kind: PermanentStillKind,
  id: string,
  still: StillBytes,
): Promise<void> {
  try {
    mkdirSync(DISK_DIR, { recursive: true });
    writeFileSync(diskPath(kind, id), still.bytes);
  } catch (err) {
    console.error(`[permanent-still] disk write failed ${kind}/${id}`, err);
  }
  if (!process.env.BLOB_READ_WRITE_TOKEN) return;
  try {
    await put(stillBlobKey(kind, id), still.bytes, {
      access: "public",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: still.contentType.startsWith("image/")
        ? still.contentType
        : "image/jpeg",
    });
  } catch (err) {
    console.error(`[permanent-still] blob write failed ${kind}/${id}`, err);
  }
}

function firstSceneRef(scenesJson: unknown): { idx: number; version: number } | null {
  if (!Array.isArray(scenesJson)) return null;
  for (let i = 0; i < scenesJson.length; i++) {
    const s = scenesJson[i];
    if (!s || typeof s !== "object") continue;
    const row = s as { idx?: unknown; version?: unknown; imageUrl?: unknown };
    if (typeof row.imageUrl !== "string" || !row.imageUrl) continue;
    const idx = typeof row.idx === "number" && row.idx >= 0 ? row.idx : i;
    const version =
      typeof row.version === "number" && row.version >= 0 ? row.version : 0;
    return { idx, version };
  }
  return null;
}

async function stillFromYoutubeProject(id: string): Promise<StillBytes | null> {
  const project = await prisma.youTubeProject.findUnique({
    where: { id },
    select: {
      thumbnailUrl: true,
      finalVideoUrl: true,
      scenesJson: true,
      autopilotJobId: true,
    },
  });
  if (!project) return null;

  const firstSceneImage = firstScenePreviewUrl(project.scenesJson);
  const picked = pickExistingStillSource({
    thumbnailUrl: project.thumbnailUrl,
    firstSceneImage,
  });
  const sourceKind = classifyStillSource({
    thumbnailUrl: project.thumbnailUrl,
    firstSceneImage,
    finalVideoUrl: project.finalVideoUrl,
  });

  if (picked && /^https?:\/\//i.test(picked)) {
    const remote = await fetchImageBytes(picked);
    if (remote) return { ...remote, source: sourceKind };
  }

  if (project.autopilotJobId) {
    if (project.thumbnailUrl && !isPermanentStillPath(project.thumbnailUrl)) {
      const thumb = await fetchAutopilotImage(project.autopilotJobId, "thumbnail");
      if (thumb) return { ...thumb, source: "thumbnail" };
    }
    const scene = firstSceneRef(project.scenesJson);
    if (scene) {
      const still = await fetchAutopilotImage(
        project.autopilotJobId,
        `scene/${scene.idx}/${scene.version}`,
      );
      if (still) return { ...still, source: "scene" };
    }
  }

  if (project.finalVideoUrl && /^https?:\/\//i.test(project.finalVideoUrl)) {
    const frame = extractFrame(project.finalVideoUrl);
    if (frame) return frame;
  }

  return null;
}

async function stillFromListing(id: string): Promise<StillBytes | null> {
  const job = await prisma.vaterListingJob.findUnique({
    where: { id },
    select: {
      stagedStillUrl: true,
      stagedStillLabeledUrl: true,
      finalUrl: true,
      videoUrl: true,
      videoVerticalUrl: true,
    },
  });
  if (!job) return null;
  const picked = pickExistingStillSource({
    stagedStillLabeledUrl: job.stagedStillLabeledUrl,
    stagedStillUrl: job.stagedStillUrl,
  });
  if (picked) {
    const remote = await fetchImageBytes(picked);
    if (remote) return { ...remote, source: "listing-still" };
  }
  const video = job.finalUrl || job.videoUrl || job.videoVerticalUrl;
  if (video && /^https?:\/\//i.test(video)) {
    const frame = extractFrame(video);
    if (frame) return frame;
  }
  return null;
}

/**
 * Return bytes for GET /still. Persists on first miss so the next hit
 * is the file, not another generate.
 */
export async function ensurePermanentStill(
  kind: PermanentStillKind,
  id: string,
): Promise<StillBytes | null> {
  if (!id || !/^[a-zA-Z0-9_-]{1,64}$/.test(id)) return null;
  const existing = await readPersistedStill(kind, id);
  if (existing) return existing;
  const made =
    kind === "listing"
      ? await stillFromListing(id)
      : await stillFromYoutubeProject(id);
  if (!made) return null;
  await writePersistedStill(kind, id, made);
  return made;
}

export type BackfillResult = {
  scanned: number;
  wrote: number;
  skipped: number;
  failed: number;
};

/**
 * Copy/extract stills for finished videos that do not have one yet.
 * Safe to call from cron or waitUntil — never blocks the Socials paint.
 */
export async function backfillPermanentStills(opts?: {
  limit?: number;
}): Promise<BackfillResult> {
  const limit = Math.max(1, Math.min(opts?.limit ?? 24, 80));
  const result: BackfillResult = { scanned: 0, wrote: 0, skipped: 0, failed: 0 };

  const projects = await prisma.youTubeProject.findMany({
    where: {
      OR: [
        { finalVideoUrl: { not: null } },
        { thumbnailUrl: { not: null } },
        { scenesJson: { not: null } },
      ],
    },
    select: { id: true },
    orderBy: { updatedAt: "desc" },
    take: limit * 3,
  });

  let listings: { id: string }[] = [];
  try {
    listings = await prisma.vaterListingJob.findMany({
      where: {
        OR: [
          { stagedStillUrl: { not: null } },
          { stagedStillLabeledUrl: { not: null } },
          { finalUrl: { not: null } },
          { videoUrl: { not: null } },
        ],
      },
      select: { id: true },
      orderBy: { updatedAt: "desc" },
      take: Math.min(12, limit),
    });
  } catch {
    listings = [];
  }

  const jobs: Array<{ kind: PermanentStillKind; id: string }> = [
    ...projects.map((p) => ({ kind: "youtube" as const, id: p.id })),
    ...listings.map((p) => ({ kind: "listing" as const, id: p.id })),
  ];

  for (const job of jobs) {
    if (result.wrote + result.skipped + result.failed >= limit) break;
    result.scanned += 1;
    try {
      const already = await readPersistedStill(job.kind, job.id);
      if (already) {
        result.skipped += 1;
        continue;
      }
      const still = await ensurePermanentStill(job.kind, job.id);
      if (still) result.wrote += 1;
      else result.skipped += 1;
    } catch (err) {
      result.failed += 1;
      console.error(`[permanent-still] backfill ${job.kind}/${job.id}`, err);
    }
  }
  return result;
}

/** Fire-and-forget after a render finishes. Never throws to the caller. */
export function persistStillInBackground(
  kind: PermanentStillKind,
  id: string,
): void {
  void ensurePermanentStill(kind, id).catch((err) => {
    console.error(`[permanent-still] persist ${kind}/${id}`, err);
  });
}
