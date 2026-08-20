-- HqSpendEntry — 2026-08-19.
-- Manual one-line spend log on the /hq Money tab ("+" button): label + amount
-- for purchases no reconciler sees (subscriptions, hardware, one-offs).
-- ADDITIVE + IDEMPOTENT.
-- Apply:
--   cd ~/tolley-site && npx prisma db execute \
--     --file prisma/migrations/20260819_hq_spend_entry/migration.sql \
--     --schema prisma/schema.prisma
CREATE TABLE IF NOT EXISTS "HqSpendEntry" (
  "id"          TEXT PRIMARY KEY,
  "label"       TEXT NOT NULL,
  "amountCents" INTEGER NOT NULL,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "HqSpendEntry_createdAt_idx" ON "HqSpendEntry"("createdAt");
