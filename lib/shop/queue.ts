import { prisma } from "@/lib/prisma";
import {
  claimNextListingJob as claimNextOn,
  enqueueActionForExisting,
  reclaimListingJobPatch,
  reclaimStaleListingJobs as reclaimStaleOn,
  type ListingJobDelegate,
  type ListingJobRow,
} from "@/lib/shop/listing-job-reclaim";

export {
  LISTING_JOB_STALE_MS,
  enqueueActionForExisting,
  isClaimableListingJob,
  isStaleRunningListingJob,
  listingJobLockAt,
  reclaimListingJobPatch,
  staleRunningWhere,
} from "@/lib/shop/listing-job-reclaim";

export type {
  EnqueueExistingAction,
  ListingJobDelegate,
  ListingJobLock,
  ListingJobRow,
} from "@/lib/shop/listing-job-reclaim";

export type DraftPlatform =
  | "fb_marketplace"
  | "ebay"
  | "mercari"
  | "poshmark"
  | "depop";

export const ALL_DRAFT_PLATFORMS: DraftPlatform[] = [
  "fb_marketplace",
  "ebay",
  "mercari",
  "poshmark",
  "depop",
];

export type ListingIntent = "post" | "delist";

interface EnqueueResult {
  jobId: string;
  platform: DraftPlatform;
  intent: ListingIntent;
  created: boolean;
  status: string;
}

function listingJobs(): ListingJobDelegate {
  return prisma.listingJob as unknown as ListingJobDelegate;
}

/**
 * Move every ListingJob stuck in running past the TTL back to queued with
 * nextAttemptAt=now and startedAt cleared (the running row is the lock).
 * Platform-agnostic. Safe to call from cron while Spark is dead.
 *
 * fb-draft-worker lives on Spark and is NOT in this repo. Spark still
 * needs a SIGTERM handler; this + /api/cron/shop/reclaim-listing-jobs
 * is the durable backstop.
 */
export async function reclaimStaleListingJobs(
  now: Date = new Date(),
): Promise<{ count: number }> {
  return reclaimStaleOn(listingJobs(), now);
}

/**
 * Reclaim stale running locks, then atomically claim the next due
 * queued|failed job. Fresh running jobs are not stolen.
 */
export async function claimNextListingJob(opts?: {
  platform?: string;
  now?: Date;
  ttlMs?: number;
}): Promise<ListingJobRow | null> {
  return claimNextOn(listingJobs(), opts);
}

/**
 * Enqueue a single (product, platform, intent) draft job. Idempotent — a job
 * already in queued/running state is left alone, a failed job is re-queued.
 * A running job older than LISTING_JOB_STALE_MS is reclaimed (queued now)
 * so a dead Spark lock cannot block the next draft.
 *
 * `intent` defaults to "post" (publish a new listing). "delist" is used by
 * the unified delist-on-sale flow when the same product has sold elsewhere.
 */
export async function enqueuePlatformDraft(
  productId: string,
  platform: DraftPlatform,
  intent: ListingIntent = "post"
): Promise<EnqueueResult> {
  const now = new Date();
  const existing = await prisma.listingJob.findFirst({
    where: { productId, platform, intent },
    orderBy: { createdAt: "desc" },
  });

  const action = enqueueActionForExisting(existing, now);

  if (existing && action === "leave") {
    return {
      jobId: existing.id,
      platform,
      intent,
      created: false,
      status: existing.status,
    };
  }

  if (existing && action === "reclaim-stale") {
    const resumed = await prisma.listingJob.update({
      where: { id: existing.id },
      data: reclaimListingJobPatch(now),
    });
    return {
      jobId: resumed.id,
      platform,
      intent,
      created: false,
      status: resumed.status,
    };
  }

  if (existing && action === "requeue-failed") {
    const resumed = await prisma.listingJob.update({
      where: { id: existing.id },
      data: {
        status: "queued",
        nextAttemptAt: now,
        lastError: null,
        lastStage: null,
      },
    });
    return {
      jobId: resumed.id,
      platform,
      intent,
      created: false,
      status: resumed.status,
    };
  }

  const job = await prisma.listingJob.create({
    data: {
      productId,
      platform,
      intent,
      status: "queued",
      nextAttemptAt: now,
    },
  });
  return {
    jobId: job.id,
    platform,
    intent,
    created: true,
    status: job.status,
  };
}

/** Enqueue draft jobs for one product on multiple platforms in parallel. */
export async function enqueueDrafts(
  productId: string,
  platforms: DraftPlatform[],
  intent: ListingIntent = "post"
): Promise<EnqueueResult[]> {
  // Sweep first so a dead running lock on another product cannot sit
  // through a bulk-add while we only touch this product's rows.
  await reclaimStaleListingJobs();
  const unique = Array.from(new Set(platforms));
  return Promise.all(unique.map((p) => enqueuePlatformDraft(productId, p, intent)));
}

/** Backwards-compat wrapper for existing callers. */
export async function enqueueFbDraft(productId: string): Promise<EnqueueResult> {
  return enqueuePlatformDraft(productId, "fb_marketplace");
}

/**
 * Returns true when the seller has connected eBay AND business policies
 * + ship-from location are cached. Until both are true, eBay jobs would
 * hard-fail at the `policies` stage, so we don't enqueue them.
 */
export async function isEbayReady(): Promise<boolean> {
  const auth = await prisma.ebayAuth.findFirst({
    orderBy: { updatedAt: "desc" },
    select: {
      refreshTokenExpiresAt: true,
      paymentPolicyId: true,
      returnPolicyId: true,
      fulfillmentPolicyId: true,
      defaultLocationKey: true,
    },
  });
  if (!auth) return false;
  if (auth.refreshTokenExpiresAt.getTime() < Date.now()) return false;
  return Boolean(
    auth.paymentPolicyId &&
      auth.returnPolicyId &&
      auth.fulfillmentPolicyId &&
      auth.defaultLocationKey
  );
}

/**
 * Generic "platform connected" check for browser-session marketplaces
 * (Mercari, Poshmark, Depop). The persistent Chromium profile on disk is the
 * real credential — PlatformAuth.sessionState is just our cache so the admin
 * UI can render status without round-tripping the worker.
 */
async function isPlatformReady(platform: DraftPlatform): Promise<boolean> {
  const auth = await prisma.platformAuth.findUnique({
    where: { platform },
    select: { sessionState: true },
  });
  return auth?.sessionState === "connected";
}

export async function isMercariReady(): Promise<boolean> {
  return isPlatformReady("mercari");
}

export async function isPoshmarkReady(): Promise<boolean> {
  return isPlatformReady("poshmark");
}

export async function isDepopReady(): Promise<boolean> {
  return isPlatformReady("depop");
}

/**
 * Resolve which platforms are currently ready to receive drafts. FB is always
 * on (the worker has been around the longest and we want everything mirrored
 * there). The others are gated on their respective auth checks.
 */
export async function readyPlatforms(): Promise<DraftPlatform[]> {
  const platforms: DraftPlatform[] = ["fb_marketplace"];
  const [ebay, mercari, poshmark, depop] = await Promise.all([
    isEbayReady(),
    isMercariReady(),
    isPoshmarkReady(),
    isDepopReady(),
  ]);
  if (ebay) platforms.push("ebay");
  if (mercari) platforms.push("mercari");
  if (poshmark) platforms.push("poshmark");
  if (depop) platforms.push("depop");
  return platforms;
}

/**
 * Convenience helper: enqueue draft jobs for every platform that's currently
 * connected and ready. Used by the create-product flow and the manual
 * cross-list endpoint.
 */
export async function enqueueAllReadyDrafts(productId: string): Promise<EnqueueResult[]> {
  const platforms = await readyPlatforms();
  return enqueueDrafts(productId, platforms);
}
