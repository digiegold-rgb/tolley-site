-- CreateTable
CREATE TABLE "StockOpportunity" (
    "id" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "supplier" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'Mixed',
    "condition" TEXT NOT NULL DEFAULT 'Unknown',
    "location" TEXT,
    "distanceMiles" DOUBLE PRECISION,
    "pickup" BOOLEAN,
    "parcel" BOOLEAN NOT NULL DEFAULT false,
    "quantity" INTEGER,
    "bidCents" INTEGER,
    "feesCents" INTEGER,
    "freightCents" INTEGER,
    "resaleCents" INTEGER,
    "resaleEvidence" TEXT,
    "endsAt" TIMESTAMP(3),
    "observedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "historical" BOOLEAN NOT NULL DEFAULT false,
    "watched" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "manifest" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockOpportunity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockPurchase" (
    "id" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "lotId" TEXT NOT NULL,
    "totalCents" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'purchased',
    "receipt" JSONB,
    "writeoffCents" INTEGER NOT NULL DEFAULT 0,
    "finalizedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockPurchase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockImport" (
    "id" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "payload" JSONB NOT NULL,
    "error" TEXT,
    "resultCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "StockImport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockSync" (
    "id" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "message" TEXT,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockSync_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StockOpportunity_sourceUrl_key" ON "StockOpportunity"("sourceUrl");

-- CreateIndex
CREATE INDEX "StockOpportunity_watched_endsAt_idx" ON "StockOpportunity"("watched", "endsAt");

-- CreateIndex
CREATE UNIQUE INDEX "StockPurchase_opportunityId_key" ON "StockPurchase"("opportunityId");

-- CreateIndex
CREATE UNIQUE INDEX "StockPurchase_lotId_key" ON "StockPurchase"("lotId");

-- CreateIndex
CREATE UNIQUE INDEX "StockImport_dedupeKey_key" ON "StockImport"("dedupeKey");

-- CreateIndex
CREATE INDEX "StockImport_status_createdAt_idx" ON "StockImport"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "StockPurchase" ADD CONSTRAINT "StockPurchase_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "StockOpportunity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockPurchase" ADD CONSTRAINT "StockPurchase_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "SourceLot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

