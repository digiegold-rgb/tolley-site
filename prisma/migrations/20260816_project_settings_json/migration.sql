-- Jelly Studio feature contract (design/jelly-feature-contract-2026-08-16.md)
-- 2026-08-16.
--
-- ONE additive column: YouTubeProject.settingsJson — the optional feature bag
-- shared by every build lane (captionPreset, overlays, cameraDefault,
-- transitionSec, musicMoods, language, pronunciations, narrationUrl, aspect,
-- brandKit, motionMode). Every key is optional; a missing key means today's
-- behavior, so no existing row changes meaning.
--
-- ADDITIVE and IDEMPOTENT: nullable, no default, no backfill, no type change,
-- nothing dropped. Adding a nullable column with no default does not rewrite
-- the table, so this is safe to apply while production is serving traffic,
-- and safe to run twice.
--
-- Apply:
--   cd ~/tolley-site && npx prisma db execute \
--     --file prisma/migrations/20260816_project_settings_json/migration.sql \
--     --schema prisma/schema.prisma

ALTER TABLE "YouTubeProject" ADD COLUMN IF NOT EXISTS "settingsJson" JSONB;
