-- CreateTable
CREATE TABLE "ChannelViewStat" (
    "id" TEXT NOT NULL,
    "channelKey" TEXT NOT NULL,
    "day" TIMESTAMP(3) NOT NULL,
    "totalViews" BIGINT,
    "dayViews" INTEGER,
    "subscribers" INTEGER,
    "pulledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChannelViewStat_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ChannelViewStat_channelKey_day_key" ON "ChannelViewStat"("channelKey", "day");
CREATE INDEX "ChannelViewStat_channelKey_day_idx" ON "ChannelViewStat"("channelKey", "day");
