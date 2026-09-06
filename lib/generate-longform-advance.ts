/**
 * Motion 2 beat advance: ffmpeg last frame of the finished MP4 → persist PNG
 * → next beat source_image_url.
 *
 * Called from the job poll route after a longform child clip lands.
 * Motion 1 syncBeatQueueFromChild does not extract frames.
 */

import { extractLastFrame } from "./generate-ffmpeg";
import {
  applyLastFrameToNext,
  findLongformBeat,
  isInFlightJobStatus,
  longformBeatByJobId,
  longformParentJobStatus,
  markLongformBeatFromChildJob,
  markLongformBeatGenerating,
  parseLongformQueue,
  rippleContinuityAfter,
  type LongformQueue,
} from "./generate-longform";
import { cardBeatId, cardQueueId, findLongformParentForChild, loadLongformJob } from "./generate-longform-store";
import { readableToBuffer } from "./generate-media";
import { gatedJobImagePath } from "./generate-output";
import { fetchStoredJobImage, persistJobPngBuffers } from "./generate-output-persist";
import { prisma } from "./prisma";

export const LAST_FRAME_OUTPUT_INDEX = 1;

export async function extractAndPersistLastFrame(opts: {
  jobId: string;
  storedMp4: string;
  existingUrls: string[];
}): Promise<{ url: string; refs: string[] }> {
  const fetched = await fetchStoredJobImage(opts.jobId, opts.storedMp4);
  const mp4 = await readableToBuffer(fetched.body);
  const png = await extractLastFrame(mp4);
  const refs = await persistJobPngBuffers(opts.jobId, [png], process.env, fetch, LAST_FRAME_OUTPUT_INDEX);
  const frameRef = refs[0];
  if (!frameRef) throw new Error("Last-frame persist returned no ref");
  const urls = opts.existingUrls.slice();
  urls[LAST_FRAME_OUTPUT_INDEX] = frameRef;
  if (!urls[0]) urls[0] = opts.storedMp4;
  await prisma.generateJob.update({
    where: { id: opts.jobId },
    data: { outputUrls: urls },
  });
  return { url: gatedJobImagePath(opts.jobId, LAST_FRAME_OUTPUT_INDEX), refs: urls };
}

export function applyContinuityAdvance(
  queue: LongformQueue,
  jobId: string,
  lastFrameUrl: string,
  ripple: boolean,
): LongformQueue {
  const idx = queue.beats.findIndex((b) => b.job_id === jobId);
  if (idx < 0) return queue;
  if (ripple) return rippleContinuityAfter(queue, idx, lastFrameUrl);
  return applyLastFrameToNext(queue, idx, lastFrameUrl);
}

export async function syncLongformFromChild(child: {
  id: string;
  status: string;
  error?: string | null;
  cardJson: unknown;
  outputUrls: string[];
}): Promise<void> {
  const parent = await findLongformParentForChild(child);
  if (!parent) return;

  let next = markLongformBeatFromChildJob(parent.queue, child.id, child);

  const existing = longformBeatByJobId(next, child.id);
  if (child.status === "done" && child.outputUrls[0] && !existing?.last_frame_url) {
    const rec =
      child.cardJson && typeof child.cardJson === "object" && !Array.isArray(child.cardJson)
        ? (child.cardJson as Record<string, unknown>)
        : {};
    const ripple = rec.ripple === true;
    try {
      const extracted = await extractAndPersistLastFrame({
        jobId: child.id,
        storedMp4: child.outputUrls[0],
        existingUrls: child.outputUrls,
      });
      next = applyContinuityAdvance(next, child.id, extracted.url, ripple);
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      next = {
        ...next,
        continuity_error: `Last-frame extract failed after ${child.id}: ${detail}`.slice(0, 500),
      };
    }
  }

  const parentStatus = longformParentJobStatus(next);
  await prisma.generateJob.update({
    where: { id: parent.row.id },
    data: {
      cardJson: next,
      status: parentStatus,
      ...(parentStatus === "running" && !parent.row.startedAt ? { startedAt: new Date() } : {}),
    },
  });
}

type ChildRow = {
  id: string;
  status: string;
  error?: string | null;
  cardJson: unknown;
  outputUrls: string[];
};

/**
 * Re-bind beat status from linked (or queue_id-tagged) children so a refresh
 * cannot leave the parent looking idle while fal is still IN_PROGRESS.
 */
export async function reconcileLongformParent(loaded: {
  row: { id: string; status: string; createdBy: string; startedAt: Date | null };
  queue: LongformQueue;
}): Promise<{ queue: LongformQueue; row: { id: string; status: string } }> {
  const ids = loaded.queue.beats.map((b) => b.job_id).filter(Boolean);
  const byId = ids.length
    ? await prisma.generateJob.findMany({ where: { id: { in: ids } } })
    : [];

  const tagged = await prisma.generateJob.findMany({
    where: {
      createdBy: loaded.row.createdBy,
      status: { in: ["queued", "running", "done", "failed"] },
      recipe: { in: ["fal-wan-i2v", "fal-wan-flf2v"] },
    },
    orderBy: { updatedAt: "desc" },
    take: 40,
  });

  const seen = new Set<string>();
  const children: ChildRow[] = [];
  for (const row of [...byId, ...tagged]) {
    if (seen.has(row.id)) continue;
    const qid = cardQueueId(row.cardJson);
    const linked = Boolean(longformBeatByJobId(loaded.queue, row.id));
    if (!linked && qid && qid !== loaded.row.id) continue;
    if (!linked && !qid) continue;
    seen.add(row.id);
    children.push(row);
  }

  let next = loaded.queue;
  for (const child of children) {
    if (isInFlightJobStatus(child.status)) {
      if (longformBeatByJobId(next, child.id)) {
        next = markLongformBeatFromChildJob(next, child.id, child);
      } else {
        const beatId = cardBeatId(child.cardJson);
        if (beatId && findLongformBeat(next, beatId)) {
          next = markLongformBeatGenerating(next, beatId, child.id);
        }
      }
      continue;
    }
    const beat = longformBeatByJobId(next, child.id);
    const beatId = beat?.id || cardBeatId(child.cardJson);
    const current = beatId ? findLongformBeat(next, beatId) : null;
    if (
      (child.status === "done" || child.status === "failed") &&
      current &&
      (current.status === "generating" || current.status === "draft")
    ) {
      await syncLongformFromChild(child);
      const fresh = await loadLongformJob(loaded.row.id);
      if (fresh) next = fresh.queue;
    }
  }

  const status = longformParentJobStatus(next);
  if (status !== loaded.row.status || next !== loaded.queue) {
    const row = await prisma.generateJob.update({
      where: { id: loaded.row.id },
      data: {
        cardJson: next,
        status,
        ...(status === "running" && !loaded.row.startedAt ? { startedAt: new Date() } : {}),
      },
    });
    return { row, queue: parseLongformQueue(row.cardJson) };
  }
  return { row: loaded.row, queue: next };
}
