-- Jelly Studio feature contract (2026-08-16) — visuals / soundtrack / brand kit.
--
-- 100% ADDITIVE and 100% IDEMPOTENT: two nullable JSONB columns, no drops, no
-- type changes, no data rewritten. Safe to apply while production is live
-- (existing code never reads these) and safe to run twice.
--
--   1. YouTubeProject.settingsJson — per-project render `features`
--      (captionPreset, overlays, cameraDefault, transitionSec, musicMoods,
--      aspect, motionMode, publishAt, brandKit override).
--   2. YouTubeStyle.brandKitJson   — reusable brand kit on the style
--      (logoUrl, captionFont, captionColor, accentColor).
--
-- Apply:
--   cd ~/tolley-site && npx prisma db execute \
--     --file prisma/migrations/20260816_jelly_features/migration.sql \
--     --schema prisma/schema.prisma

ALTER TABLE "YouTubeProject" ADD COLUMN IF NOT EXISTS "settingsJson" JSONB;
ALTER TABLE "YouTubeStyle"   ADD COLUMN IF NOT EXISTS "brandKitJson" JSONB;
