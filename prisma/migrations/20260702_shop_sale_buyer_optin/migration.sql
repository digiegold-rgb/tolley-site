-- Buyer-contact capture for the Amazon 3-sales push (list-building infra).
-- ShopSale already had buyerEmail/buyerName; this adds a phone column and an
-- explicit consent flag. marketingOptIn MUST default false — Amazon's Apr
-- 2026 policy update allows affiliate links in opted-in SMS/DM, which means
-- affirmative opt-in, not silence. Fully additive, existing rows unaffected.
ALTER TABLE "ShopSale"
  ADD COLUMN IF NOT EXISTS "buyerPhone" TEXT,
  ADD COLUMN IF NOT EXISTS "marketingOptIn" BOOLEAN NOT NULL DEFAULT false;
