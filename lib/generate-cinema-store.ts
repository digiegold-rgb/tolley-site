/**
 * Persist a Cinema parent GenerateJob (fal-cinema).
 * Child clips are fal-seedance-ref / fal-kling-elements; stitch is fal-wan-stitch.
 */

import {
  CINEMA_CHILD_KLING,
  CINEMA_CHILD_SEEDANCE,
  CINEMA_RECIPE,
  cinemaBeatByJobId,
  cinemaParentJobStatus,
  markCinemaBeatFromChildJob,
  parseCinemaQueue,
  type CinemaQueue,
} from "./generate-cinema";
import { latestQueueActorFilter } from "./generate-queue-binding";
import { serializeJob } from "./generate-job-store";
import { prisma } from "./prisma";

export async function loadCinemaJob(id: string) {
  const row = await prisma.generateJob.findUnique({ where: { id } });
  if (!row || row.recipe !== CINEMA_RECIPE) return null;
  return { row, queue: parseCinemaQueue(row.cardJson) };
}

export async function latestCinemaJob(createdBy: string) {
  const row = await prisma.generateJob.findFirst({
    where: { createdBy: latestQueueActorFilter(createdBy), recipe: CINEMA_RECIPE },
    orderBy: { updatedAt: "desc" },
  });
  if (!row) return null;
  return { row, queue: parseCinemaQueue(row.cardJson) };
}

type GenerateJobRow = NonNullable<Awaited<ReturnType<typeof prisma.generateJob.findUnique>>>;

export async function saveCinemaQueue(opts: {
  createdBy: string;
  queue: CinemaQueue;
  id?: string;
}): Promise<{ row: GenerateJobRow; queue: CinemaQueue }> {
  const queue = parseCinemaQueue(opts.queue);
  const status = cinemaParentJobStatus(queue);
  const data = {
    recipe: CINEMA_RECIPE,
    cardJson: queue,
    createdBy: opts.createdBy,
    status,
  };
  const row = opts.id
    ? await prisma.generateJob.update({
        where: { id: opts.id },
        data: { cardJson: data.cardJson, recipe: CINEMA_RECIPE, status },
      })
    : await prisma.generateJob.create({ data });
  return { row, queue: parseCinemaQueue(row.cardJson) };
}

export function serializeCinemaJob(row: {
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
    queue: parseCinemaQueue(row.cardJson),
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

export function cardWantsCinema(cardJson: unknown): boolean {
  const rec =
    cardJson && typeof cardJson === "object" && !Array.isArray(cardJson)
      ? (cardJson as Record<string, unknown>)
      : {};
  return rec.cinema === true || rec.kind === "cinema" || rec.kind === "fal-cinema";
}

export async function findCinemaParentForChild(child: {
  id: string;
  cardJson: unknown;
}): Promise<{ row: GenerateJobRow; queue: CinemaQueue } | null> {
  const queueId = cardQueueId(child.cardJson);
  if (queueId) {
    const loaded = await loadCinemaJob(queueId);
    if (!loaded) return null;
    if (!cinemaBeatByJobId(loaded.queue, child.id)) return null;
    return loaded;
  }
  if (!cardWantsCinema(child.cardJson)) return null;
  const recent = await prisma.generateJob.findMany({
    where: { recipe: CINEMA_RECIPE },
    orderBy: { updatedAt: "desc" },
    take: 20,
  });
  for (const row of recent) {
    const queue = parseCinemaQueue(row.cardJson);
    if (!cinemaBeatByJobId(queue, child.id)) continue;
    return { row, queue };
  }
  return null;
}

export const CINEMA_CHILD_RECIPES = [CINEMA_CHILD_SEEDANCE, CINEMA_CHILD_KLING] as const;

export { markCinemaBeatFromChildJob };
