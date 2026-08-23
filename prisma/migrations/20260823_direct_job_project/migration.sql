-- VaterDirectJob.projectId — 2026-08-23.
--
-- A brief dictated in the Dictate lane produces a real YouTubeProject, but the
-- job row had no link to it. So a video Trey dictated appeared in NEITHER
-- Script Review nor Project History, and the thread could only say "Claude is
-- working" with no way to reach the render it had started.
--
-- Nullable + additive: existing rows stay NULL and the UI just omits the link.
-- ADDITIVE + IDEMPOTENT.
-- Apply:
--   cd ~/tolley-site && npx prisma db execute \
--     --file prisma/migrations/20260823_direct_job_project/migration.sql \
--     --schema prisma/schema.prisma
ALTER TABLE "VaterDirectJob" ADD COLUMN IF NOT EXISTS "projectId" TEXT;
CREATE INDEX IF NOT EXISTS "VaterDirectJob_projectId_idx" ON "VaterDirectJob"("projectId");
