-- Chat-driven Modal stills on /generate.
-- One row per job card Confirm/Go. Fully additive.

CREATE TABLE IF NOT EXISTS "GenerateJob" (
  "id"          TEXT NOT NULL,
  "status"      TEXT NOT NULL DEFAULT 'queued',
  "recipe"      TEXT NOT NULL DEFAULT 'qwen-image-edit-2511',
  "cardJson"    JSONB NOT NULL,
  "modalCallId" TEXT,
  "outputUrls"  TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "error"       TEXT,
  "createdBy"   TEXT NOT NULL,
  "startedAt"   TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,

  CONSTRAINT "GenerateJob_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "GenerateJob_status_createdAt_idx" ON "GenerateJob"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "GenerateJob_createdBy_createdAt_idx" ON "GenerateJob"("createdBy", "createdAt");
CREATE INDEX IF NOT EXISTS "GenerateJob_modalCallId_idx" ON "GenerateJob"("modalCallId");
