-- GPU router v2: persist backend, kind, wall time, and provider cost on VideoGeneration.
ALTER TABLE "VideoGeneration" ADD COLUMN IF NOT EXISTS "backend" TEXT;
ALTER TABLE "VideoGeneration" ADD COLUMN IF NOT EXISTS "kind" TEXT;
ALTER TABLE "VideoGeneration" ADD COLUMN IF NOT EXISTS "durationMs" INTEGER;
ALTER TABLE "VideoGeneration" ADD COLUMN IF NOT EXISTS "costUsd" DOUBLE PRECISION;
