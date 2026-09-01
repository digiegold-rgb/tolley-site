-- Jelly Studio: copy a character onto another owned YouTubeStyle (2026-09-01).
--
-- Account-global flag (root login, not a workspace tab). Default ON so the
-- Characters screen offers the destination-studio picker without a setup step.
-- The adopt route stays free — this column only gates the UI + the copy path.
--
-- Apply manually with the repo convention:
--   npx prisma db execute --file prisma/migrations/20260901_character_studio_copy/migration.sql --schema prisma/schema.prisma

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "characterStudioCopy" BOOLEAN NOT NULL DEFAULT true;
