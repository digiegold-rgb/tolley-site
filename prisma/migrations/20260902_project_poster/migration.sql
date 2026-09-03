-- Jelly Studio Library / Socials — permanent tile posters (2026-09-02).
--
-- ADDITIVE + IDEMPOTENT. One optional column on YouTubeProject. Nothing
-- dropped, nothing rewritten; safe against a live database, safe to run twice.
--
-- Apply by hand BEFORE the code that selects it deploys:
--   npx tsx scripts/apply-project-poster-2026-09-02.ts --apply
-- (Prisma's findMany() with no select reads every column, so the column has
-- to exist before the client that knows about it goes live.)

ALTER TABLE "YouTubeProject" ADD COLUMN IF NOT EXISTS "posterUrl" TEXT;
