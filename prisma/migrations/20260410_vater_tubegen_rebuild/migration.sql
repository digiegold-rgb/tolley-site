-- AlterTable
ALTER TABLE "public"."YouTubeProject" DROP COLUMN "manusAudioTaskId",
DROP COLUMN "manusTaskId",
DROP COLUMN "voiceId",
ADD COLUMN     "autopilotJobId" TEXT,
ADD COLUMN     "captionTimings" JSONB,
ADD COLUMN     "customStylePrompt" TEXT,
ADD COLUMN     "finalVideoUrl" TEXT,
ADD COLUMN     "goal" TEXT,
ADD COLUMN     "mode" TEXT NOT NULL DEFAULT 'transcribe',
ADD COLUMN     "rssItemId" TEXT,
ADD COLUMN     "scenesJson" JSONB,
ADD COLUMN     "sourcePrinciples" JSONB,
ADD COLUMN     "sourceType" TEXT NOT NULL DEFAULT 'manual',
ADD COLUMN     "stylePreset" TEXT NOT NULL DEFAULT 'cinematic',
ADD COLUMN     "topic" TEXT,
ADD COLUMN     "verificationReport" JSONB,
ADD COLUMN     "verifiedScript" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "voiceCloneId" TEXT,
ALTER COLUMN "sourceUrl" DROP NOT NULL;

-- CreateTable
CREATE TABLE "public"."VaterRssFeed" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "title" TEXT,
    "feedType" TEXT NOT NULL,
    "autoPipeline" BOOLEAN NOT NULL DEFAULT false,
    "defaultGoal" TEXT,
    "defaultWords" INTEGER,
    "defaultVoiceId" TEXT,
    "defaultStyle" TEXT,
    "lastPolledAt" TIMESTAMP(3),
    "lastItemGuid" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VaterRssFeed_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."VaterRssItem" (
    "id" TEXT NOT NULL,
    "feedId" TEXT NOT NULL,
    "guid" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "description" TEXT,
    "thumbnail" TEXT,
    "discoveredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VaterRssItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."VaterVoiceClone" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "samplePath" TEXT NOT NULL,
    "sampleText" TEXT,
    "language" TEXT NOT NULL DEFAULT 'en',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VaterVoiceClone_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VaterRssFeed_url_key" ON "public"."VaterRssFeed"("url");

-- CreateIndex
CREATE INDEX "VaterRssFeed_feedType_idx" ON "public"."VaterRssFeed"("feedType");

-- CreateIndex
CREATE INDEX "VaterRssItem_discoveredAt_idx" ON "public"."VaterRssItem"("discoveredAt");

-- CreateIndex
CREATE UNIQUE INDEX "VaterRssItem_feedId_guid_key" ON "public"."VaterRssItem"("feedId", "guid");

-- CreateIndex
CREATE UNIQUE INDEX "VaterVoiceClone_name_key" ON "public"."VaterVoiceClone"("name");

-- CreateIndex
CREATE UNIQUE INDEX "YouTubeProject_rssItemId_key" ON "public"."YouTubeProject"("rssItemId");

-- CreateIndex
CREATE INDEX "YouTubeProject_sourceType_idx" ON "public"."YouTubeProject"("sourceType");

-- AddForeignKey
ALTER TABLE "public"."VaterRssItem" ADD CONSTRAINT "VaterRssItem_feedId_fkey" FOREIGN KEY ("feedId") REFERENCES "public"."VaterRssFeed"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."YouTubeProject" ADD CONSTRAINT "YouTubeProject_rssItemId_fkey" FOREIGN KEY ("rssItemId") REFERENCES "public"."VaterRssItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

