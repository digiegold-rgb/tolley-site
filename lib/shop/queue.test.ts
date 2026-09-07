/**
 * lib/shop/queue.test.ts
 *   npx tsx --test lib/shop/queue.test.ts
 *
 * ListingJob reclaim: running past the TTL becomes claimable again;
 * a fresh running lock is not stolen. No Neon — in-memory delegate.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  LISTING_JOB_STALE_MS,
  claimNextListingJob,
  enqueueActionForExisting,
  isClaimableListingJob,
  isStaleRunningListingJob,
  reclaimListingJobPatch,
  reclaimStaleListingJobs,
  staleRunningWhere,
  type ListingJobDelegate,
  type ListingJobRow,
} from "./listing-job-reclaim.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

function readApp(rel: string): string {
  return readFileSync(join(root, rel), "utf8");
}

const NOW = new Date("2026-09-07T12:00:00.000Z");

function row(partial: Partial<ListingJobRow> & Pick<ListingJobRow, "id" | "status">): ListingJobRow {
  return {
    productId: `p-${partial.id}`,
    platform: "fb_marketplace",
    intent: "post",
    attempts: 1,
    lastError: null,
    lastStage: null,
    nextAttemptAt: NOW,
    startedAt: null,
    completedAt: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...partial,
  };
}

function cmp(a: unknown, op: { lte?: Date; in?: string[] } | Date | string | null): boolean {
  if (op && typeof op === "object" && !(op instanceof Date) && "lte" in op && op.lte) {
    if (!(a instanceof Date)) return false;
    return a.getTime() <= op.lte.getTime();
  }
  if (op && typeof op === "object" && !(op instanceof Date) && "in" in op && Array.isArray(op.in)) {
    return op.in.includes(a as string);
  }
  return a === op;
}

function matches(job: ListingJobRow, where: Record<string, unknown> | undefined): boolean {
  if (!where) return true;
  for (const [key, raw] of Object.entries(where)) {
    if (key === "OR" && Array.isArray(raw)) {
      if (!raw.some((clause) => matches(job, clause as Record<string, unknown>))) return false;
      continue;
    }
    const value = (job as Record<string, unknown>)[key];
    if (!cmp(value, raw as { lte?: Date; in?: string[] } | Date | string | null)) return false;
  }
  return true;
}

function memoryListingJobs(seed: ListingJobRow[]): ListingJobDelegate & { rows: ListingJobRow[] } {
  const rows = seed.map((j) => ({ ...j }));

  function apply(job: ListingJobRow, data: Record<string, unknown>): ListingJobRow {
    const next = { ...job, ...data, updatedAt: NOW } as ListingJobRow;
    return next;
  }

  return {
    rows,
    async findFirst(args) {
      const where = args.where as Record<string, unknown> | undefined;
      const orderBy = args.orderBy as Array<Record<string, string>> | undefined;
      const found = rows.filter((j) => matches(j, where));
      if (orderBy?.length) {
        found.sort((a, b) => {
          for (const spec of orderBy) {
            const [field, dir] = Object.entries(spec)[0]!;
            const av = (a as Record<string, unknown>)[field];
            const bv = (b as Record<string, unknown>)[field];
            const an = av instanceof Date ? av.getTime() : String(av);
            const bn = bv instanceof Date ? bv.getTime() : String(bv);
            if (an < bn) return dir === "desc" ? 1 : -1;
            if (an > bn) return dir === "desc" ? -1 : 1;
          }
          return 0;
        });
      }
      return found[0] ?? null;
    },
    async findUnique(args) {
      const where = args.where as { id?: string };
      return rows.find((j) => j.id === where.id) ?? null;
    },
    async update(args) {
      const where = args.where as { id: string };
      const idx = rows.findIndex((j) => j.id === where.id);
      if (idx < 0) throw new Error(`missing ${where.id}`);
      rows[idx] = apply(rows[idx]!, args.data as Record<string, unknown>);
      return rows[idx]!;
    },
    async updateMany(args) {
      const where = args.where as Record<string, unknown>;
      const data = args.data as Record<string, unknown>;
      let count = 0;
      for (let i = 0; i < rows.length; i++) {
        if (!matches(rows[i]!, where)) continue;
        rows[i] = apply(rows[i]!, data);
        count++;
      }
      return { count };
    },
  };
}

describe("listing job stale lock", () => {
  it("flags running older than the TTL and ignores fresh running / other statuses", () => {
    const staleAt = new Date(NOW.getTime() - LISTING_JOB_STALE_MS - 1);
    const freshAt = new Date(NOW.getTime() - 2 * 60 * 1000);
    assert.equal(
      isStaleRunningListingJob({ status: "running", startedAt: staleAt }, NOW),
      true,
    );
    assert.equal(
      isStaleRunningListingJob({ status: "running", startedAt: freshAt }, NOW),
      false,
    );
    assert.equal(
      isStaleRunningListingJob({ status: "running", startedAt: null, updatedAt: staleAt }, NOW),
      true,
    );
    assert.equal(isStaleRunningListingJob({ status: "queued", startedAt: staleAt }, NOW), false);
    assert.equal(isStaleRunningListingJob({ status: "failed", startedAt: staleAt }, NOW), false);
    assert.equal(isStaleRunningListingJob({ status: "done", startedAt: staleAt }, NOW), false);
    assert.equal(LISTING_JOB_STALE_MS, 20 * 60 * 1000);
  });

  it("claimability: stale running is due; fresh running is not stolen", () => {
    const stale = row({
      id: "stale",
      status: "running",
      startedAt: new Date(NOW.getTime() - LISTING_JOB_STALE_MS - 5_000),
    });
    const fresh = row({
      id: "fresh",
      status: "running",
      startedAt: new Date(NOW.getTime() - 60_000),
    });
    const queued = row({ id: "queued", status: "queued", nextAttemptAt: NOW });
    const later = row({
      id: "later",
      status: "queued",
      nextAttemptAt: new Date(NOW.getTime() + 60_000),
    });
    assert.equal(isClaimableListingJob(stale, NOW), true);
    assert.equal(isClaimableListingJob(fresh, NOW), false);
    assert.equal(isClaimableListingJob(queued, NOW), true);
    assert.equal(isClaimableListingJob(later, NOW), false);
  });

  it("enqueue leaves a fresh running lock alone and reclaims a stale one", () => {
    const stale = { status: "running", startedAt: new Date(NOW.getTime() - LISTING_JOB_STALE_MS - 1) };
    const fresh = { status: "running", startedAt: new Date(NOW.getTime() - 30_000) };
    assert.equal(enqueueActionForExisting(stale, NOW), "reclaim-stale");
    assert.equal(enqueueActionForExisting(fresh, NOW), "leave");
    assert.equal(enqueueActionForExisting({ status: "queued" }, NOW), "leave");
    assert.equal(enqueueActionForExisting({ status: "failed" }, NOW), "requeue-failed");
    assert.equal(enqueueActionForExisting({ status: "done" }, NOW), "create");
    assert.equal(enqueueActionForExisting(null, NOW), "create");
  });

  it("reclaim patch clears the running lock and is due immediately", () => {
    const patch = reclaimListingJobPatch(NOW);
    assert.equal(patch.status, "queued");
    assert.equal(patch.nextAttemptAt.getTime(), NOW.getTime());
    assert.equal(patch.startedAt, null);
    assert.match(patch.lastError, /reclaimed/);
    assert.equal(patch.lastStage, "reclaim");
    const where = staleRunningWhere(NOW);
    assert.equal(where.status, "running");
    assert.ok(where.OR.length === 2);
  });
});

describe("reclaim + claim", () => {
  it("running older than TTL becomes claimable again; fresh running is not stolen", async () => {
    const stale = row({
      id: "stale-fb",
      status: "running",
      platform: "fb_marketplace",
      startedAt: new Date(NOW.getTime() - LISTING_JOB_STALE_MS - 1_000),
      updatedAt: new Date(NOW.getTime() - LISTING_JOB_STALE_MS - 1_000),
      attempts: 1,
    });
    const fresh = row({
      id: "fresh-fb",
      status: "running",
      platform: "fb_marketplace",
      startedAt: new Date(NOW.getTime() - 3 * 60 * 1000),
      updatedAt: new Date(NOW.getTime() - 3 * 60 * 1000),
      attempts: 1,
    });
    const ebay = row({
      id: "ebay-run",
      status: "running",
      platform: "ebay",
      startedAt: new Date(NOW.getTime() - 60_000),
      attempts: 2,
    });
    const db = memoryListingJobs([stale, fresh, ebay]);

    const first = await claimNextListingJob(db, {
      platform: "fb_marketplace",
      now: NOW,
    });
    assert.ok(first);
    assert.equal(first.id, "stale-fb");
    assert.equal(first.status, "running");
    assert.equal(first.startedAt?.getTime(), NOW.getTime());
    assert.equal(first.attempts, 2);
    assert.equal(first.lastStage, null);

    const leftover = db.rows.find((j) => j.id === "fresh-fb");
    assert.equal(leftover?.status, "running");
    assert.equal(leftover?.startedAt?.getTime(), fresh.startedAt?.getTime());

    const second = await claimNextListingJob(db, {
      platform: "fb_marketplace",
      now: NOW,
    });
    assert.equal(second, null, "fresh running must not be stolen");

    const ebayAfter = db.rows.find((j) => j.id === "ebay-run");
    assert.equal(ebayAfter?.status, "running");
    assert.equal(ebayAfter?.startedAt?.getTime(), ebay.startedAt?.getTime());
  });

  it("reclaimStaleListingJobs only touches stale running rows", async () => {
    const db = memoryListingJobs([
      row({
        id: "old",
        status: "running",
        startedAt: new Date(NOW.getTime() - LISTING_JOB_STALE_MS),
      }),
      row({
        id: "live",
        status: "running",
        startedAt: new Date(NOW.getTime() - 60_000),
      }),
      row({ id: "q", status: "queued" }),
    ]);
    const { count } = await reclaimStaleListingJobs(db, NOW);
    assert.equal(count, 1);
    assert.equal(db.rows.find((j) => j.id === "old")?.status, "queued");
    assert.equal(db.rows.find((j) => j.id === "old")?.startedAt, null);
    assert.equal(db.rows.find((j) => j.id === "live")?.status, "running");
    assert.equal(db.rows.find((j) => j.id === "q")?.status, "queued");
  });
});

describe("watchdog wiring", () => {
  it("Vercel cron reclaims on a shop path so Spark being dead still unblocks", () => {
    const vercel = JSON.parse(readApp("vercel.json")) as {
      crons: Array<{ path: string; schedule: string }>;
    };
    const cron = vercel.crons.find((c) => c.path === "/api/cron/shop/reclaim-listing-jobs");
    assert.ok(cron, "expected /api/cron/shop/reclaim-listing-jobs in vercel.json");
    assert.equal(cron.schedule, "*/10 * * * *");

    const src = readApp("app/api/cron/shop/reclaim-listing-jobs/route.ts");
    assert.match(src, /reclaimStaleListingJobs/);
    assert.match(src, /CRON_SECRET/);
    assert.match(src, /LISTING_JOB_STALE_MS/);

    const reclaim = readApp("lib/shop/listing-job-reclaim.ts");
    assert.match(reclaim, /fb-draft-worker/);
    assert.match(reclaim, /SIGTERM/);
    assert.match(reclaim, /NOT in this repo/);
    const queue = readApp("lib/shop/queue.ts");
    assert.match(queue, /reclaimStaleListingJobs/);
    assert.match(queue, /enqueueActionForExisting/);
  });
});
