-- HqAdsSnapshot — 2026-08-30.
-- Cached paid-ads snapshot for the /hq Posts-tab ads card.
-- Single-row upsert (id=1), written by /api/cron/hq-ads-sync.
-- ADDITIVE + IDEMPOTENT.
-- Apply:
--   cd ~/tolley-site && npx prisma db execute \
--     --file prisma/migrations/20260830_hq_ads_snapshot/migration.sql \
--     --schema prisma/schema.prisma
CREATE TABLE IF NOT EXISTS "HqAdsSnapshot" (
  "id"        INTEGER PRIMARY KEY DEFAULT 1,
  "payload"   JSONB NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
