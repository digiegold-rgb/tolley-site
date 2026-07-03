-- AlterTable
ALTER TABLE "Product" ADD COLUMN "tiktokShopId" TEXT;

-- CreateTable
CREATE TABLE "AmazonStatsSnapshot" (
    "id" TEXT NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "programType" TEXT NOT NULL DEFAULT 'associates',
    "earningsToday" DOUBLE PRECISION,
    "earningsMTD" DOUBLE PRECISION,
    "earningsYTD" DOUBLE PRECISION,
    "clicksToday" INTEGER,
    "clicksMTD" INTEGER,
    "itemsShipped" INTEGER,
    "itemsOrdered" INTEGER,
    "conversionRate" DOUBLE PRECISION,
    "topAsins" JSONB,
    "raw" JSONB,

    CONSTRAINT "AmazonStatsSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AmazonStatsSnapshot_programType_capturedAt_idx" ON "AmazonStatsSnapshot"("programType", "capturedAt");

-- CreateTable
CREATE TABLE "InfluencerStatsSnapshot" (
    "id" TEXT NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "videoViews" INTEGER,
    "storefrontVisits" INTEGER,
    "onsiteEarnings" DOUBLE PRECISION,
    "offsiteEarnings" DOUBLE PRECISION,
    "followerCount" INTEGER,
    "topVideos" JSONB,
    "raw" JSONB,

    CONSTRAINT "InfluencerStatsSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InfluencerStatsSnapshot_capturedAt_idx" ON "InfluencerStatsSnapshot"("capturedAt");

-- CreateTable
CREATE TABLE "AmazonFeatureFlag" (
    "key" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "reason" TEXT,
    "activatedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AmazonFeatureFlag_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "IdeaList" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "coverImageUrl" TEXT,
    "amazonListId" TEXT,
    "productIds" JSONB NOT NULL,
    "followerCount" INTEGER,
    "lastSyncAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IdeaList_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "IdeaList_amazonListId_key" ON "IdeaList"("amazonListId");

-- CreateIndex
CREATE INDEX "IdeaList_amazonListId_idx" ON "IdeaList"("amazonListId");

-- CreateTable
CREATE TABLE "AmazonVideoUpload" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "amazonVideoId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "uploadedAt" TIMESTAMP(3),
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "onsiteEarnings" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lastReconcileAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AmazonVideoUpload_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AmazonVideoUpload_amazonVideoId_key" ON "AmazonVideoUpload"("amazonVideoId");

-- CreateIndex
CREATE INDEX "AmazonVideoUpload_productId_idx" ON "AmazonVideoUpload"("productId");

-- CreateIndex
CREATE INDEX "AmazonVideoUpload_status_idx" ON "AmazonVideoUpload"("status");

-- CreateTable
CREATE TABLE "AmazonProductCache" (
    "asin" TEXT NOT NULL,
    "title" TEXT,
    "priceCents" INTEGER,
    "imageUrl" TEXT,
    "availability" TEXT,
    "rating" DOUBLE PRECISION,
    "reviewCount" INTEGER,
    "reviewsSample" JSONB,
    "raw" JSONB,
    "cachedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AmazonProductCache_pkey" PRIMARY KEY ("asin")
);

-- CreateIndex
CREATE INDEX "AmazonProductCache_cachedAt_idx" ON "AmazonProductCache"("cachedAt");

-- CreateTable
CREATE TABLE "CreatorConnectionsCampaign" (
    "id" TEXT NOT NULL,
    "amazonId" TEXT,
    "brandName" TEXT NOT NULL,
    "productAsin" TEXT,
    "commissionPct" DOUBLE PRECISION,
    "budget" DOUBLE PRECISION,
    "category" TEXT,
    "endDate" TIMESTAMP(3),
    "applied" BOOLEAN NOT NULL DEFAULT false,
    "appliedAt" TIMESTAMP(3),
    "accepted" BOOLEAN NOT NULL DEFAULT false,
    "acceptedAt" TIMESTAMP(3),
    "notes" TEXT,
    "raw" JSONB,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreatorConnectionsCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CreatorConnectionsCampaign_amazonId_key" ON "CreatorConnectionsCampaign"("amazonId");

-- CreateIndex
CREATE INDEX "CreatorConnectionsCampaign_applied_accepted_idx" ON "CreatorConnectionsCampaign"("applied", "accepted");

-- CreateIndex
CREATE INDEX "CreatorConnectionsCampaign_category_idx" ON "CreatorConnectionsCampaign"("category");
