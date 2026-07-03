-- CreateTable
CREATE TABLE "RetailDeal" (
    "id" TEXT NOT NULL,
    "retailer" TEXT NOT NULL,
    "retailerLabel" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "imageUrl" TEXT,
    "productUrl" TEXT,
    "brand" TEXT,
    "model" TEXT,
    "zip" TEXT,
    "buyPrice" DOUBLE PRECISION NOT NULL,
    "originalPrice" DOUBLE PRECISION,
    "onClearance" BOOLEAN NOT NULL DEFAULT false,
    "resaleMedian" DOUBLE PRECISION,
    "resaleNetMedian" DOUBLE PRECISION,
    "resaleSamples" INTEGER NOT NULL DEFAULT 0,
    "estProfit" DOUBLE PRECISION,
    "marginPct" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'new',
    "productId" TEXT,
    "alertedAt" TIMESTAMP(3),
    "sourcedAt" TIMESTAMP(3),
    "dismissedAt" TIMESTAMP(3),
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RetailDeal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RetailDeal_retailer_externalId_key" ON "RetailDeal"("retailer", "externalId");

-- CreateIndex
CREATE INDEX "RetailDeal_status_marginPct_idx" ON "RetailDeal"("status", "marginPct");

-- CreateIndex
CREATE INDEX "RetailDeal_createdAt_idx" ON "RetailDeal"("createdAt");

-- CreateIndex
CREATE INDEX "RetailDeal_productId_idx" ON "RetailDeal"("productId");
