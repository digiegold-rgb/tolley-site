-- CreateTable
CREATE TABLE "ShopVideoProduct" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "productUrl" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "realVideoUrl" TEXT,
    "seller" TEXT NOT NULL,
    "variant" TEXT NOT NULL,
    "commissionBps" INTEGER NOT NULL,
    "priceCents" INTEGER NOT NULL,
    "rightsConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "authenticityConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "realFootageConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopVideoProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShopVideoAccount" (
    "id" TEXT NOT NULL,
    "externalAccountId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "dailyQuota" INTEGER NOT NULL DEFAULT 3,
    "weeklyQuota" INTEGER NOT NULL DEFAULT 21,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopVideoAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShopVideoBatch" (
    "id" TEXT NOT NULL,
    "requestKey" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "scene" TEXT NOT NULL,
    "overlay" TEXT NOT NULL,
    "maxSpendCents" INTEGER NOT NULL,
    "reservedCents" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShopVideoBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShopVideoJob" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "productSnapshot" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "allowanceCents" INTEGER NOT NULL,
    "providerEstimateCents" INTEGER,
    "actualCostCents" INTEGER,
    "costEvidence" TEXT,
    "callId" TEXT,
    "receipts" JSONB,
    "outputSize" INTEGER,
    "outputSha256" TEXT,
    "outputDuration" DOUBLE PRECISION,
    "outputWidth" INTEGER,
    "outputHeight" INTEGER,
    "error" TEXT,
    "review" JSONB,
    "handoff" JSONB,
    "reviewedAt" TIMESTAMP(3),
    "handoffAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "publishedUrl" TEXT,
    "publishedId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopVideoJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShopVideoCommission" (
    "id" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "evidence" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopVideoCommission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ShopVideoProduct_productId_key" ON "ShopVideoProduct"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "ShopVideoAccount_externalAccountId_key" ON "ShopVideoAccount"("externalAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "ShopVideoBatch_requestKey_key" ON "ShopVideoBatch"("requestKey");

-- CreateIndex
CREATE UNIQUE INDEX "ShopVideoJob_publishedId_key" ON "ShopVideoJob"("publishedId");

-- CreateIndex
CREATE INDEX "ShopVideoJob_status_updatedAt_idx" ON "ShopVideoJob"("status", "updatedAt");

-- CreateIndex
CREATE INDEX "ShopVideoJob_batchId_createdAt_idx" ON "ShopVideoJob"("batchId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ShopVideoCommission_externalId_key" ON "ShopVideoCommission"("externalId");

-- CreateIndex
CREATE INDEX "ShopVideoCommission_status_updatedAt_idx" ON "ShopVideoCommission"("status", "updatedAt");

-- AddForeignKey
ALTER TABLE "ShopVideoJob" ADD CONSTRAINT "ShopVideoJob_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ShopVideoBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopVideoCommission" ADD CONSTRAINT "ShopVideoCommission_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "ShopVideoJob"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

