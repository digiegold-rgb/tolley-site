/**
 * Cinema beat advance: previous clip MP4 becomes the next beat's @Video ref.
 * No last-frame extract (that's Motion 2 / Wan).
 */

import {
  applyPrevClipToNext,
  cinemaBeatByJobId,
  cinemaParentJobStatus,
  findCinemaBeat,
  isInFlightJobStatus,
  markCinemaBeatFromChildJob,
  markCinemaBeatGenerating,
  parseCinemaQueue,
  type CinemaQueue,
} from "./generate-cinema";
import { cardBeatId, cardQueueId, findCinemaParentForChild, loadCinemaJob } from "./generate-cinema-store";
import { formatStuckQueueError, isStuckInFlightChild } from "./generate-queue-binding";
import { gatedJobImagePath } from "./generate-output";
import { prisma } from "./prisma";
import { persistMotionVideo, pollFalMotion, falModelIdFromCard } from "./generate-motion";

export function applyCinemaContinuity(queue: CinemaQueue, jobId: string, videoUrl: string): CinemaQueue {
  const idx = queue.beats.findIndex((b) => b.job_id === jobId);
  if (idx < 0) return queue;
  return applyPrevClipToNext(queue, idx, videoUrl);
}

export async function syncCinemaFromChild(child: {
  id: string;
  status: string;
  error?: string | null;
  cardJson: unknown;
  outputUrls: string[];
}): Promise<void> {
  const parent = await findCinemaParentForChild(child);
  if (!parent) return;

  let next = markCinemaBeatFromChildJob(parent.queue, child.id, child);
  if (child.status === "done" && child.outputUrls[0]) {
    next = applyCinemaContinuity(next, child.id, gatedJobImagePath(child.id, 0));
  }

  const parentStatus = cinemaParentJobStatus(next);
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
  modalCallId?: string | null;
  recipe?: string;
  startedAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
};

async function unlockStuckCinemaChild(child: ChildRow): Promise<ChildRow> {
  if (!isStuckInFlightChild(child) || !child.modalCallId) {
    if (isStuckInFlightChild(child)) {
      const failed = await prisma.generateJob.update({
        where: { id: child.id },
        data: {
          status: "failed",
          error: formatStuckQueueError("No fal request id."),
          completedAt: new Date(),
        },
      });
      return failed;
    }
    return child;
  }
  try {
    const poll = await pollFalMotion(falModelIdFromCard(child.cardJson, child.recipe || ""), child.modalCallId);
    if ("done" in poll && poll.done) {
      const url = await persistMotionVideo(child.id, poll.videoUrl, poll.contentType);
      const done = await prisma.generateJob.update({
        where: { id: child.id },
        data: { status: "done", outputUrls: [url], completedAt: new Date(), error: null },
      });
      return done;
    }
    if ("failed" in poll && poll.failed) {
      const failed = await prisma.generateJob.update({
        where: { id: child.id },
        data: { status: "failed", error: poll.error.slice(0, 2000), completedAt: new Date() },
      });
      return failed;
    }
    const failed = await prisma.generateJob.update({
      where: { id: child.id },
      data: {
        status: "failed",
        error: formatStuckQueueError(`fal still ${"status" in poll ? poll.status : "pending"}.`),
        completedAt: new Date(),
      },
    });
    return failed;
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    const failed = await prisma.generateJob.update({
      where: { id: child.id },
      data: {
        status: "failed",
        error: formatStuckQueueError(detail).slice(0, 2000),
        completedAt: new Date(),
      },
    });
    return failed;
  }
}

export async function reconcileCinemaParent(loaded: {
  row: { id: string; status: string; createdBy: string; startedAt: Date | null };
  queue: CinemaQueue;
}): Promise<{ queue: CinemaQueue; row: { id: string; status: string } }> {
  const ids = loaded.queue.beats.map((b) => b.job_id).filter(Boolean);
  const byId = ids.length ? await prisma.generateJob.findMany({ where: { id: { in: ids } } }) : [];

  const tagged = await prisma.generateJob.findMany({
    where: {
      createdBy: loaded.row.createdBy,
      status: { in: ["queued", "running", "done", "failed"] },
      recipe: { in: ["fal-seedance-ref", "fal-kling-elements"] },
    },
    orderBy: { updatedAt: "desc" },
    take: 40,
  });

  const seen = new Set<string>();
  const children: ChildRow[] = [];
  for (const row of [...byId, ...tagged]) {
    if (seen.has(row.id)) continue;
    const qid = cardQueueId(row.cardJson);
    const linked = Boolean(cinemaBeatByJobId(loaded.queue, row.id));
    if (!linked && qid && qid !== loaded.row.id) continue;
    if (!linked && !qid) continue;
    seen.add(row.id);
    children.push(row);
  }

  let next = loaded.queue;
  for (let child of children) {
    if (isInFlightJobStatus(child.status) && isStuckInFlightChild(child)) {
      child = await unlockStuckCinemaChild(child);
    }
    if (isInFlightJobStatus(child.status)) {
      if (cinemaBeatByJobId(next, child.id)) {
        next = markCinemaBeatFromChildJob(next, child.id, child);
      } else {
        const beatId = cardBeatId(child.cardJson);
        if (beatId && findCinemaBeat(next, beatId)) {
          next = markCinemaBeatGenerating(next, beatId, child.id);
        }
      }
      continue;
    }
    const beat = cinemaBeatByJobId(next, child.id);
    const beatId = beat?.id || cardBeatId(child.cardJson);
    const current = beatId ? findCinemaBeat(next, beatId) : null;
    if (
      (child.status === "done" || child.status === "failed") &&
      current &&
      (current.status === "generating" || current.status === "draft")
    ) {
      await syncCinemaFromChild(child);
      const fresh = await loadCinemaJob(loaded.row.id);
      if (fresh) next = fresh.queue;
    }
  }

  const status = cinemaParentJobStatus(next);
  if (status !== loaded.row.status || next !== loaded.queue) {
    const row = await prisma.generateJob.update({
      where: { id: loaded.row.id },
      data: {
        cardJson: next,
        status,
        ...(status === "running" && !loaded.row.startedAt ? { startedAt: new Date() } : {}),
      },
    });
    return { row, queue: parseCinemaQueue(row.cardJson) };
  }
  return { row: loaded.row, queue: next };
}
