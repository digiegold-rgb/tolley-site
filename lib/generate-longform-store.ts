/**
 * Persist a Motion 2 longform queue on a parent GenerateJob (fal-wan-longform).
 * Child clips are normal motion jobs; stitch is fal-wan-stitch.
 */

import {
  LONGFORM_RECIPE,
  emptyLongformQueue,
  longformBeatByJobId,
  longformParentJobStatus,
  markLongformBeatFromChildJob,
  parseLongformQueue,
  type LongformQueue,
} from "./generate-longform";
import { serializeJob } from "./generate-job-store";
import { prisma } from "./prisma";

export async function loadLongformJob(id: string) {
  const row = await prisma.generateJob.findUnique({ where: { id } });
  if (!row || row.recipe !== LONGFORM_RECIPE) return null;
  return { row, queue: parseLongformQueue(row.cardJson) };
}

export async function latestLongformJob(createdBy: string) {
  const row = await prisma.generateJob.findFirst({
    where: { createdBy, recipe: LONGFORM_RECIPE },
    orderBy: { updatedAt: "desc" },
  });
  if (!row) return null;
  return { row, queue: parseLongformQueue(row.cardJson) };
}

type GenerateJobRow = NonNullable<Awaited<ReturnType<typeof prisma.generateJob.findUnique>>>;

export async function saveLongformQueue(opts: {
  createdBy: string;
  queue: LongformQueue;
  id?: string;
}): Promise<{ row: GenerateJobRow; queue: LongformQueue }> {
  const queue = parseLongformQueue(opts.queue);
  const status = longformParentJobStatus(queue);
  const data = {
    recipe: LONGFORM_RECIPE,
    cardJson: queue,
    createdBy: opts.createdBy,
    status,
  };
  const row = opts.id
    ? await prisma.generateJob.update({
        where: { id: opts.id },
        data: { cardJson: data.cardJson, recipe: LONGFORM_RECIPE, status },
      })
    : await prisma.generateJob.create({ data });
  return { row, queue: parseLongformQueue(row.cardJson) };
}

export function serializeLongformJob(row: {
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
    queue: parseLongformQueue(row.cardJson),
  };
}

export function cardQueueId(cardJson: unknown): string {
  const rec =
    cardJson && typeof cardJson === "object" && !Array.isArray(cardJson)
      ? (cardJson as Record<string, unknown>)
      : {};
  return typeof rec.queue_id === "string" ? rec.queue_id.trim() : "";
}

export function cardBeatId(cardJson: unknown): string {
  const rec =
    cardJson && typeof cardJson === "object" && !Array.isArray(cardJson)
      ? (cardJson as Record<string, unknown>)
      : {};
  return typeof rec.beat_id === "string" ? rec.beat_id.trim() : "";
}

export function cardWantsLongform(cardJson: unknown): boolean {
  const rec =
    cardJson && typeof cardJson === "object" && !Array.isArray(cardJson)
      ? (cardJson as Record<string, unknown>)
      : {};
  return rec.longform === true || rec.kind === "longform" || rec.kind === "motion2";
}

export async function findLongformParentForChild(child: {
  id: string;
  cardJson: unknown;
}): Promise<{ row: GenerateJobRow; queue: LongformQueue } | null> {
  const queueId = cardQueueId(child.cardJson);
  if (queueId) {
    const loaded = await loadLongformJob(queueId);
    if (!loaded) return null;
    if (!longformBeatByJobId(loaded.queue, child.id)) return null;
    return loaded;
  }
  if (!cardWantsLongform(child.cardJson)) return null;
  const recent = await prisma.generateJob.findMany({
    where: { recipe: LONGFORM_RECIPE },
    orderBy: { updatedAt: "desc" },
    take: 20,
  });
  for (const row of recent) {
    const queue = parseLongformQueue(row.cardJson);
    if (!longformBeatByJobId(queue, child.id)) continue;
    return { row, queue };
  }
  return null;
}

export { emptyLongformQueue, markLongformBeatFromChildJob };
