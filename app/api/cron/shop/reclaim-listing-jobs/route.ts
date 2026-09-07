/**
 * GET/POST /api/cron/shop/reclaim-listing-jobs
 *
 * Watchdog for ListingJob rows stuck in status=running after the Spark
 * fb-draft-worker (or any platform drainer) dies on SIGTERM / Playwright
 * "browser context closed". Drainers only retry queued|failed, so a dead
 * running lock is a deadlock until someone requeues by hand.
 *
 * This route is the durable path: it runs on Vercel cron even when Spark
 * is down. TTL is LISTING_JOB_STALE_MS (20 min) from startedAt, or
 * updatedAt when startedAt is null. Every ListingJob platform is eligible
 * — not FB-only.
 *
 * Spark still needs its own SIGTERM handler to mark the current job
 * failed+requeueable immediately; this cron is the backstop. Worker
 * source is not in this repo.
 *
 * Schedule: every 10 minutes (vercel.json).
 * Auth: Authorization: Bearer ${CRON_SECRET}, or a shop-admin session
 * so ops can hit it without a UI click-path.
 */

import { NextRequest, NextResponse } from "next/server";
import { validateShopAdmin } from "@/lib/shop-auth";
import { secretEquals } from "@/lib/secret-compare";
import {
  LISTING_JOB_STALE_MS,
  reclaimStaleListingJobs,
} from "@/lib/shop/queue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

async function authorized(req: NextRequest): Promise<boolean> {
  if (secretEquals(req.headers.get("authorization"), `Bearer ${process.env.CRON_SECRET}`)) {
    return true;
  }
  return validateShopAdmin().catch(() => false);
}

async function handle(req: NextRequest) {
  if (!(await authorized(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const { count } = await reclaimStaleListingJobs(now);

  return NextResponse.json({
    ok: true,
    reclaimed: count,
    staleMs: LISTING_JOB_STALE_MS,
    cutoff: new Date(now.getTime() - LISTING_JOB_STALE_MS).toISOString(),
    finishedAt: now.toISOString(),
  });
}

export async function GET(req: NextRequest) {
  return handle(req);
}

export async function POST(req: NextRequest) {
  return handle(req);
}
