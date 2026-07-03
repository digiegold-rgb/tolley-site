-- AlterTable: add markdown / clearance signal fields
ALTER TABLE "RetailDeal"
  ADD COLUMN IF NOT EXISTS "savings" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "discountPct" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "promoType" TEXT,
  ADD COLUMN IF NOT EXISTS "storeName" TEXT,
  ADD COLUMN IF NOT EXISTS "inStockQty" INTEGER;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "RetailDeal_status_discountPct_idx" ON "RetailDeal"("status", "discountPct");
