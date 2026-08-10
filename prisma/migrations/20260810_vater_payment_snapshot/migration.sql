-- Vater payment snapshots (2026-08-10): store the all-time billing state at
-- the moment each payment is recorded, so the next "current due" can be
-- broken down by category (current − baseline) instead of showing one number.
ALTER TABLE "VaterPayment" ADD COLUMN IF NOT EXISTS "snapshotJson" JSONB;
