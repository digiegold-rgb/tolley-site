-- Absence-based sold detection for the FB Marketplace mirror.
-- Fully additive: one new column with a default, so existing rows backfill to 0.
-- Counts consecutive healthy live-mirror runs in which a listed product was NOT
-- seen on Ruthann's FB seller dashboard. Crossing the threshold flips the
-- product to status='sold' (she removes sold items from Marketplace rather than
-- leaving the "Sold" badge). See app/api/shop/fb-sync/route.ts.
ALTER TABLE "Product"
  ADD COLUMN IF NOT EXISTS "fbMissCount" INTEGER NOT NULL DEFAULT 0;
