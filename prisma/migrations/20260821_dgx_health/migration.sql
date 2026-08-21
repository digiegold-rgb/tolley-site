-- DgxHealth — 2026-08-21.
-- Live DGX vitals for the /hq top banner. Single-row upsert (id=1), pushed
-- every 30s by ~/bin/dgx-health-push.sh on the DGX.
-- ADDITIVE + IDEMPOTENT.
-- Apply:
--   cd ~/tolley-site && npx prisma db execute \
--     --file prisma/migrations/20260821_dgx_health/migration.sql \
--     --schema prisma/schema.prisma
CREATE TABLE IF NOT EXISTS "DgxHealth" (
  "id"        INTEGER PRIMARY KEY DEFAULT 1,
  "payload"   JSONB NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
