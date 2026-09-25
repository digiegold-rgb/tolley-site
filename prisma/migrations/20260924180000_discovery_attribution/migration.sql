ALTER TABLE "GrowthLead" ADD COLUMN "attribution" JSONB, ADD COLUMN "referralRootId" TEXT, ADD COLUMN "discoveryStage" TEXT;
ALTER TABLE "LeadAction" ADD COLUMN "attribution" JSONB;
ALTER TABLE "SiteView" ADD COLUMN "attribution" JSONB;
CREATE TABLE "DiscoveryRevenue" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "receiptKey" TEXT NOT NULL,
  "leadId" TEXT NOT NULL REFERENCES "GrowthLead"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "amountCents" INTEGER NOT NULL CHECK ("amountCents" > 0),
  "collectedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "DiscoveryRevenue_receiptKey_key" ON "DiscoveryRevenue"("receiptKey");
CREATE INDEX "DiscoveryRevenue_leadId_collectedAt_idx" ON "DiscoveryRevenue"("leadId", "collectedAt");
