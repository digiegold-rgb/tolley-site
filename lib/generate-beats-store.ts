/**
 * Persist a Motion beat queue on a parent GenerateJob (recipe fal-wan-beats).
 * Child clips are normal motion jobs; stitch is fal-wan-stitch.
 */

import {
  BEATS_RECIPE,
  STITCH_RECIPE,
  beatByJobId,
  emptyBeatQueue,
  markBeatFromChildJob,
  parseBeatQueue,
  type BeatQueue,
} from "./generate-beats";
import { serializeJob } from "./generate-job-store";
import { prisma } from "./prisma";

export function cardIsBeatQueue(card: unknown): boolean {
  const rec = card && typeof card === "object" && !Array.isArray(card) ? (card as Record<string, unknown>) : {};
  return rec.recipe === BEATS_RECIPE || Array.isArray(rec.beats);
}

export async function loadBeatQueueJob(id: string) {
  const row = await prisma.generateJob.findUnique({ where: { id } });
  if (!row || row.recipe !== BEATS_RECIPE) return null;
  return { row, queue: parseBeatQueue(row.cardJson) };
}

export async function latestBeatQueueJob(createdBy: string) {
  const row = await prisma.generateJob.findFirst({
    where: { createdBy, recipe: BEATS_RECIPE },
    orderBy: { updatedAt: "desc" },
  });
  if (!row) return null;
  return { row, queue: parseBeatQueue(row.cardJson) };
}

export async function saveBeatQueue(opts: {
  createdBy: string;
  queue: BeatQueue;
  id?: string;
}): Promise<{ row: Awaited<ReturnType<typeof prisma.generateJob.findUnique>>; queue: BeatQueue }> {
  const data = {
    recipe: BEATS_RECIPE,
    cardJson: parseBeatQueue(opts.queue),
    createdBy: opts.createdBy,
    status: "queued",
  };
  const row = opts.id
    ? await prisma.generateJob.update({
        where: { id: opts.id },
        data: { cardJson: data.cardJson, recipe: BEATS_RECIPE },
      })
    : await prisma.generateJob.create({ data });
  return { row, queue: parseBeatQueue(row.cardJson) };
}

export async function syncBeatQueueFromChild(child: {
  id: string;
  status: string;
  error?: string | null;
  cardJson: unknown;
}): Promise<void> {
  const rec =
    child.cardJson && typeof child.cardJson === "object" && !Array.isArray(child.cardJson)
      ? (child.cardJson as Record<string, unknown>)
      : {};
  const queueId = typeof rec.queue_id === "string" ? rec.queue_id.trim() : "";
  if (queueId) {
    const loaded = await loadBeatQueueJob(queueId);
    if (!loaded) return;
    if (!beatByJobId(loaded.queue, child.id)) return;
    const next = markBeatFromChildJob(loaded.queue, child.id, child);
    await prisma.generateJob.update({
      where: { id: loaded.row.id },
      data: { cardJson: next },
    });
    return;
  }
  const recent = await prisma.generateJob.findMany({
    where: { recipe: BEATS_RECIPE },
    orderBy: { updatedAt: "desc" },
    take: 20,
  });
  for (const row of recent) {
    const queue = parseBeatQueue(row.cardJson);
    if (!beatByJobId(queue, child.id)) continue;
    const next = markBeatFromChildJob(queue, child.id, child);
    await prisma.generateJob.update({ where: { id: row.id }, data: { cardJson: next } });
    return;
  }
}

export function serializeBeatQueueJob(row: {
  id: string;
  status: string;
  recipe: string;
  cardJson: unknown;
  modalCallId: string | null;
  outputUrls: string[];
  error: string | null;
  createdBy: string;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    job: serializeJob(row),
    queue: parseBeatQueue(row.cardJson),
  };
}

export { emptyBeatQueue, STITCH_RECIPE };
