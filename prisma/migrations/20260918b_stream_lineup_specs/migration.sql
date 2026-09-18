-- tolley.io/stream lineups — quantity + Amazon-sourced package specs (2026-09-18).
-- ADDITIVE + IDEMPOTENT: new nullable/defaulted columns only. Applied by hand before deploy.
ALTER TABLE "StreamLineupItem" ADD COLUMN IF NOT EXISTS "quantity"        INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "StreamLineupItem" ADD COLUMN IF NOT EXISTS "dimsSource"      TEXT;
ALTER TABLE "StreamLineupItem" ADD COLUMN IF NOT EXISTS "specsNote"       TEXT;
ALTER TABLE "StreamLineupItem" ADD COLUMN IF NOT EXISTS "amazonTitle"     TEXT;
ALTER TABLE "StreamLineupItem" ADD COLUMN IF NOT EXISTS "amazonPriceAt"   TIMESTAMP(3);
ALTER TABLE "StreamLineupItem" ADD COLUMN IF NOT EXISTS "specsCheckedAt"  TIMESTAMP(3);
