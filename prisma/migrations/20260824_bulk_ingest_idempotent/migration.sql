-- Idempotent bulk-ingest batches: client-supplied batchId + per-row idx,
-- unique so a replayed POST can't duplicate a batch.
ALTER TABLE "BulkIngestJob" ADD COLUMN "idx" INTEGER NOT NULL DEFAULT 0;

-- Backfill positions so existing multi-row batches satisfy the unique index
UPDATE "BulkIngestJob" b SET "idx" = s.rn - 1
FROM (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY "batchId" ORDER BY "createdAt", id) AS rn
  FROM "BulkIngestJob"
) s
WHERE b.id = s.id;

CREATE UNIQUE INDEX "BulkIngestJob_batchId_idx_key" ON "BulkIngestJob"("batchId", "idx");
