-- Batch-animate reconcile anchor (2026-07-02).
-- The animate-all kickoff returns an animateAllJobId to the client, and the
-- per-scene $ charge only lands when the client calls /animate-all/finalize.
-- If the tab closes after kickoff, the Modal batch still runs but never bills.
-- Persisting the batch job id (and its start time) on the project lets the
-- invoice-sweep reconciler find done-but-unfinalized batches and backfill the
-- `animall_<jobId>_<idx>` usage with the same idempotency keys the client path
-- uses (double-billing stays impossible). Fully additive; existing rows keep
-- NULLs and are ignored by the reconciler.
ALTER TABLE "YouTubeProject"
  ADD COLUMN IF NOT EXISTS "animateAllJobId" TEXT,
  ADD COLUMN IF NOT EXISTS "animateAllStartedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "YouTubeProject_animateAllStartedAt_idx"
  ON "YouTubeProject" ("animateAllStartedAt");
