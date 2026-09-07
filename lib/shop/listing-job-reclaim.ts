/**
 * ListingJob stale-lock reclaim + claim.
 *
 * Drainers (fb-draft-worker on Spark, plus ebay/mercari/…) only retry
 * queued|failed. A SIGTERM / Playwright "browser context closed" leaves
 * status=running forever — a deadlock. These helpers move running rows
 * older than LISTING_JOB_STALE_MS back to queued with nextAttemptAt=now
 * and startedAt cleared (the running row is the lock).
 *
 * Spark worker source is NOT in this repo. Vercel cron
 * /api/cron/shop/reclaim-listing-jobs is the durable path when Spark is
 * dead. Spark still needs a matching SIGTERM handler to mark the current
 * job failed+requeueable immediately.
 *
 * No Prisma import — unit tests inject an in-memory delegate.
 */

export const LISTING_JOB_STALE_MS = 20 * 60 * 1000;

export type ListingJobLock = {
  id?: string;
  status: string;
  startedAt?: Date | null;
  updatedAt?: Date | null;
  nextAttemptAt?: Date;
};

export type ListingJobRow = {
  id: string;
  productId: string;
  platform: string;
  intent: string;
  status: string;
  attempts: number;
  lastError: string | null;
  lastStage: string | null;
  nextAttemptAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type ListingJobDelegate = {
  findFirst: (args: Record<string, unknown>) => Promise<ListingJobRow | null>;
  findUnique: (args: Record<string, unknown>) => Promise<ListingJobRow | null>;
  update: (args: Record<string, unknown>) => Promise<ListingJobRow>;
  updateMany: (args: Record<string, unknown>) => Promise<{ count: number }>;
};

/** When the running lock was taken. Missing timestamps are treated as stale. */
export function listingJobLockAt(job: ListingJobLock): Date | null {
  return job.startedAt ?? job.updatedAt ?? null;
}

export function isStaleRunningListingJob(
  job: ListingJobLock,
  now: Date = new Date(),
  ttlMs: number = LISTING_JOB_STALE_MS,
): boolean {
  if (job.status !== "running") return false;
  const lockAt = listingJobLockAt(job);
  if (!lockAt) return true;
  return now.getTime() - lockAt.getTime() >= ttlMs;
}

/**
 * queued|failed that are due, or running past the TTL (after reclaim).
 * Fresh running jobs are not claimable — that is the lock.
 */
export function isClaimableListingJob(
  job: ListingJobLock,
  now: Date = new Date(),
  ttlMs: number = LISTING_JOB_STALE_MS,
): boolean {
  if (job.status === "queued" || job.status === "failed") {
    const due = job.nextAttemptAt ?? new Date(0);
    return due.getTime() <= now.getTime();
  }
  return isStaleRunningListingJob(job, now, ttlMs);
}

export function staleRunningWhere(
  now: Date = new Date(),
  ttlMs: number = LISTING_JOB_STALE_MS,
) {
  const cutoff = new Date(now.getTime() - ttlMs);
  return {
    status: "running" as const,
    OR: [
      { startedAt: { lte: cutoff } },
      { startedAt: null, updatedAt: { lte: cutoff } },
    ],
  };
}

export function reclaimListingJobPatch(now: Date = new Date()) {
  return {
    status: "queued",
    nextAttemptAt: now,
    startedAt: null,
    lastError: "reclaimed: stale running lock (worker died, SIGTERM, or hung Playwright)",
    lastStage: "reclaim",
  };
}

export type EnqueueExistingAction = "leave" | "requeue-failed" | "reclaim-stale" | "create";

/** Decision for enqueuePlatformDraft — keep platforms other than FB intact. */
export function enqueueActionForExisting(
  existing: ListingJobLock | null | undefined,
  now: Date = new Date(),
  ttlMs: number = LISTING_JOB_STALE_MS,
): EnqueueExistingAction {
  if (!existing) return "create";
  if (existing.status === "queued") return "leave";
  if (existing.status === "running") {
    return isStaleRunningListingJob(existing, now, ttlMs) ? "reclaim-stale" : "leave";
  }
  if (existing.status === "failed") return "requeue-failed";
  return "create";
}

/**
 * Move every ListingJob stuck in running past the TTL back to queued with
 * nextAttemptAt=now and startedAt cleared. Platform-agnostic.
 */
export async function reclaimStaleListingJobs(
  listingJob: ListingJobDelegate,
  now: Date = new Date(),
  ttlMs: number = LISTING_JOB_STALE_MS,
): Promise<{ count: number }> {
  const result = await listingJob.updateMany({
    where: staleRunningWhere(now, ttlMs),
    data: reclaimListingJobPatch(now),
  });
  return { count: result.count };
}

/**
 * Reclaim stale running locks, then atomically claim the next due
 * queued|failed job. Fresh running jobs are not stolen.
 */
export async function claimNextListingJob(
  listingJob: ListingJobDelegate,
  opts?: { platform?: string; now?: Date; ttlMs?: number },
): Promise<ListingJobRow | null> {
  const now = opts?.now ?? new Date();
  const ttlMs = opts?.ttlMs ?? LISTING_JOB_STALE_MS;

  await reclaimStaleListingJobs(listingJob, now, ttlMs);

  const where: Record<string, unknown> = {
    status: { in: ["queued", "failed"] },
    nextAttemptAt: { lte: now },
  };
  if (opts?.platform) where.platform = opts.platform;

  const next = await listingJob.findFirst({
    where,
    orderBy: [{ nextAttemptAt: "asc" }, { createdAt: "asc" }],
  });
  if (!next) return null;

  const claimed = await listingJob.updateMany({
    where: { id: next.id, status: { in: ["queued", "failed"] } },
    data: {
      status: "running",
      startedAt: now,
      lastError: null,
      lastStage: null,
      attempts: next.attempts + 1,
    },
  });
  if (claimed.count === 0) {
    return claimNextListingJob(listingJob, opts);
  }
  return listingJob.findUnique({ where: { id: next.id } });
}
