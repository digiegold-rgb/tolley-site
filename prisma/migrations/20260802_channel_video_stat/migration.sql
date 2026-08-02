-- CreateTable
CREATE TABLE "ChannelVideoStat" (
    "id" TEXT NOT NULL,
    "channelKey" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL,
    "views" BIGINT NOT NULL DEFAULT 0,
    "pulledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChannelVideoStat_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ChannelVideoStat_channelKey_videoId_key" ON "ChannelVideoStat"("channelKey", "videoId");
CREATE INDEX "ChannelVideoStat_channelKey_publishedAt_idx" ON "ChannelVideoStat"("channelKey", "publishedAt");
