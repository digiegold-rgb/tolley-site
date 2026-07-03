-- Additive: opt-in flags + last-sync timestamps for grocery auto-sync
ALTER TABLE "FoodHousehold"
  ADD COLUMN IF NOT EXISTS "walmartAutoSync"    BOOLEAN   NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "samsclubAutoSync"   BOOLEAN   NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "lastWalmartSyncAt"  TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "lastSamsclubSyncAt" TIMESTAMP(3);
