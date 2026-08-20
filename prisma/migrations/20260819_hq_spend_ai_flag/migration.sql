-- HqSpendEntry.ai — 2026-08-19.
-- "AI spend" checkbox on the Money-tab + form: flagged entries also flow into
-- the AI P&L ledger (AiSpendLive provider 'manual-hq', incremented on add,
-- decremented on delete). ADDITIVE + IDEMPOTENT.
-- Apply:
--   cd ~/tolley-site && npx prisma db execute \
--     --file prisma/migrations/20260819_hq_spend_ai_flag/migration.sql \
--     --schema prisma/schema.prisma
ALTER TABLE "HqSpendEntry" ADD COLUMN IF NOT EXISTS "ai" BOOLEAN NOT NULL DEFAULT false;
