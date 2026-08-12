-- 2026-08-11: (1) PostLogEntry.videoKey — joins the never-pruned VideoCost
-- ledger so /hq run cards can show render spend next to posting spend.
-- (2) CityRankStat — monthly SerpAPI search-rank sweep for the 33 listings
-- cities (city-rank-track cron).
ALTER TABLE "PostLogEntry" ADD COLUMN IF NOT EXISTS "videoKey" TEXT;

CREATE TABLE IF NOT EXISTS "CityRankStat" (
    "id" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "st" TEXT NOT NULL,
    "engine" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "position" INTEGER,
    "foundUrl" TEXT,
    "videoId" TEXT,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CityRankStat_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "CityRankStat_city_engine_checkedAt_idx" ON "CityRankStat"("city", "engine", "checkedAt");
CREATE INDEX IF NOT EXISTS "CityRankStat_checkedAt_idx" ON "CityRankStat"("checkedAt");
