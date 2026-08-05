-- Scope /hq YouTube stats per channel.
-- Before this, the stats cron used whichever OAuth refresh token was most
-- recently updated, so authorizing @yourkchomes silently re-pointed all of
-- /hq at the new channel and the legacy channel's readings vanished.
ALTER TABLE "YouTubeVideo" ADD COLUMN IF NOT EXISTS "channelId" TEXT;
ALTER TABLE "YouTubeVideo" ADD COLUMN IF NOT EXISTS "channelTitle" TEXT;
CREATE INDEX IF NOT EXISTS "YouTubeVideo_channelId_idx" ON "YouTubeVideo"("channelId");

-- Everything recorded before today came from the legacy @yourkchome channel.
UPDATE "YouTubeVideo"
   SET "channelId" = 'UCd4bJKIvbGOIAT-GK4K-3_w',
       "channelTitle" = 'Your KC Homes! (legacy / crypto)'
 WHERE "channelId" IS NULL;
