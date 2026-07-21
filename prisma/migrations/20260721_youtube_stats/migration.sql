-- YouTube channel analytics (/hq Stats tab) — YouTubeVideo + YouTubeVideoStat
-- daily snapshots + HqStatsAnalysis (one-click Gemini recaps).
-- Fully additive — CREATE TABLE IF NOT EXISTS + IF NOT EXISTS indexes, no
-- existing table or row is touched, so a re-run is a no-op.

CREATE TABLE IF NOT EXISTS "YouTubeVideo" (
  "videoId"     TEXT NOT NULL,
  "title"       TEXT NOT NULL,
  "publishedAt" TIMESTAMP(3) NOT NULL,
  "durationSec" INTEGER,
  "pipeline"    TEXT NOT NULL DEFAULT 'other',
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,

  CONSTRAINT "YouTubeVideo_pkey" PRIMARY KEY ("videoId")
);

CREATE TABLE IF NOT EXISTS "YouTubeVideoStat" (
  "id"                      TEXT NOT NULL,
  "videoId"                 TEXT NOT NULL,
  "day"                     TIMESTAMP(3) NOT NULL,
  "views"                   INTEGER NOT NULL DEFAULT 0,
  "likes"                   INTEGER NOT NULL DEFAULT 0,
  "comments"                INTEGER NOT NULL DEFAULT 0,
  "estimatedMinutesWatched" DOUBLE PRECISION,
  "avgViewDurationSec"      DOUBLE PRECISION,
  "avgViewPct"              DOUBLE PRECISION,
  "subsGained"              INTEGER,
  "impressions"             INTEGER,
  "ctr"                     DOUBLE PRECISION,
  "pulledAt"                TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "YouTubeVideoStat_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "YouTubeVideoStat_videoId_fkey" FOREIGN KEY ("videoId")
    REFERENCES "YouTubeVideo"("videoId") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "YouTubeVideoStat_videoId_day_key"
  ON "YouTubeVideoStat"("videoId", "day");
CREATE INDEX IF NOT EXISTS "YouTubeVideoStat_day_idx"
  ON "YouTubeVideoStat"("day");

CREATE TABLE IF NOT EXISTS "HqStatsAnalysis" (
  "id"        TEXT NOT NULL,
  "markdown"  TEXT NOT NULL,
  "inputHash" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "HqStatsAnalysis_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "HqStatsAnalysis_createdAt_idx"
  ON "HqStatsAnalysis"("createdAt");
