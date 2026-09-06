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
  markLongformBeatFromChildJob,
  rippleContinuityAfter,
  type LongformQueue,
} from "./generate-longform";
import { findLongformParentForChild } from "./generate-longform-store";
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

  if (child.status === "done" && child.outputUrls[0]) {
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

  await prisma.generateJob.update({
    where: { id: parent.row.id },
    data: { cardJson: next },
  });
}
