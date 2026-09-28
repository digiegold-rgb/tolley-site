ALTER TABLE "LiveSettings" ADD COLUMN "campaignPaused" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "LiveShow" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'scheduled', ADD COLUMN "metrics" JSONB NOT NULL DEFAULT '{}';
-- Keep known historical show windows and future schedules compatible.
UPDATE "LiveShow" SET "status" = CASE WHEN "endedAt" IS NOT NULL THEN 'ended' WHEN "confirmedUntil" > NOW() THEN 'live' WHEN "confirmedUntil" IS NOT NULL THEN 'ended' WHEN "startsAt" > NOW() THEN 'confirmed' ELSE 'scheduled' END;
CREATE TABLE "LiveCampaignPost" (
 "id" TEXT NOT NULL PRIMARY KEY, "showId" TEXT, "kind" TEXT NOT NULL, "format" TEXT NOT NULL DEFAULT 'feed',
 "platform" TEXT NOT NULL, "accountId" TEXT NOT NULL, "caption" TEXT NOT NULL, "mediaUrl" TEXT,
 "dueAt" TIMESTAMP(3) NOT NULL, "expiresAt" TIMESTAMP(3) NOT NULL, "status" TEXT NOT NULL DEFAULT 'draft',
 "manual" BOOLEAN NOT NULL DEFAULT false, "externalId" TEXT, "url" TEXT, "error" TEXT,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX "LiveCampaignPost_showId_kind_platform_accountId_key" ON "LiveCampaignPost"("showId", "kind", "platform", "accountId");
CREATE INDEX "LiveCampaignPost_status_dueAt_idx" ON "LiveCampaignPost"("status", "dueAt");
CREATE TABLE "LiveDeal" (
 "id" TEXT NOT NULL PRIMARY KEY, "showId" TEXT NOT NULL, "item" TEXT NOT NULL, "priceCents" INTEGER NOT NULL,
 "soldAt" TIMESTAMP(3) NOT NULL, "evidence" TEXT NOT NULL, "verified" BOOLEAN NOT NULL DEFAULT false,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "LiveDeal_showId_item_soldAt_key" ON "LiveDeal"("showId", "item", "soldAt");
CREATE INDEX "LiveDeal_verified_soldAt_idx" ON "LiveDeal"("verified", "soldAt");
