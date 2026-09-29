ALTER TABLE "LiveShow" ADD COLUMN "liveStartedAt" TIMESTAMP(3);
CREATE TABLE "GrowthAutomation" ("id" TEXT PRIMARY KEY DEFAULT 'owner', "blogPaused" BOOLEAN NOT NULL DEFAULT true, "announcementsPaused" BOOLEAN NOT NULL DEFAULT true, "updatedAt" TIMESTAMP(3) NOT NULL);
CREATE TABLE "GrowthActivity" ("id" TEXT PRIMARY KEY, "kind" TEXT NOT NULL, "status" TEXT NOT NULL, "title" TEXT NOT NULL, "detail" TEXT NOT NULL, "url" TEXT, "metadata" JSONB NOT NULL DEFAULT '{}', "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL);
CREATE INDEX "GrowthActivity_createdAt_idx" ON "GrowthActivity"("createdAt");
CREATE TABLE "BuildStory" ("id" TEXT PRIMARY KEY, "slot" TEXT NOT NULL UNIQUE, "sourceKey" TEXT NOT NULL UNIQUE, "slug" TEXT NOT NULL UNIQUE, "title" TEXT NOT NULL, "description" TEXT NOT NULL, "body" TEXT NOT NULL, "evidence" JSONB NOT NULL, "status" TEXT NOT NULL DEFAULT 'draft', "retrospective" BOOLEAN NOT NULL DEFAULT false, "publishedAt" TIMESTAMP(3), "notificationStatus" TEXT NOT NULL DEFAULT 'pending', "notificationId" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL);
CREATE INDEX "BuildStory_status_publishedAt_idx" ON "BuildStory"("status", "publishedAt");
CREATE TABLE "GrowthInquiryPhoto" ("id" TEXT PRIMARY KEY, "leadId" TEXT NOT NULL REFERENCES "GrowthLead"("id") ON DELETE CASCADE, "image" BYTEA NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX "GrowthInquiryPhoto_leadId_idx" ON "GrowthInquiryPhoto"("leadId");
