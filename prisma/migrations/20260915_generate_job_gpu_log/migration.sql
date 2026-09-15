-- GPU router v1: persist Modal (later Nebius) backend, kind, wall time, and cost.
ALTER TABLE "GenerateJob" ADD COLUMN IF NOT EXISTS "backend" TEXT NOT NULL DEFAULT 'modal';
ALTER TABLE "GenerateJob" ADD COLUMN IF NOT EXISTS "kind" TEXT;
ALTER TABLE "GenerateJob" ADD COLUMN IF NOT EXISTS "durationMs" INTEGER;
ALTER TABLE "GenerateJob" ADD COLUMN IF NOT EXISTS "costUsd" DOUBLE PRECISION;

CREATE INDEX IF NOT EXISTS "GenerateJob_backend_createdAt_idx" ON "GenerateJob"("backend", "createdAt");
