-- ChannelVideoStat.url — 2026-08-17.
-- Per-video permalinks so the /hq Posts tab can link every tracked video.
-- YouTube ids rebuild a watch URL trivially; Facebook reel ids do NOT (only
-- the Graph API knows whether an id lives at /reel/<id> or /<page>/videos/<id>).
-- ADDITIVE + IDEMPOTENT.
-- Apply:
--   cd ~/tolley-site && npx prisma db execute \
--     --file prisma/migrations/20260817_channel_video_url/migration.sql \
--     --schema prisma/schema.prisma
ALTER TABLE "ChannelVideoStat" ADD COLUMN IF NOT EXISTS "url" TEXT;
