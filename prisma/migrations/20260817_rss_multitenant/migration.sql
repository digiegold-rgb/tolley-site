-- VaterRssFeed → multi-tenant — 2026-08-17.
-- RSS Feeds was owner-only because the table had no userId (a single URL
-- namespace = Jared's feeds). Every /animate user now gets their own feeds:
-- add userId, backfill legacy rows to the owner, replace the global url
-- unique with (userId, url).
-- ADDITIVE + IDEMPOTENT.
-- Apply:
--   cd ~/tolley-site && npx prisma db execute \
--     --file prisma/migrations/20260817_rss_multitenant/migration.sql \
--     --schema prisma/schema.prisma
ALTER TABLE "VaterRssFeed" ADD COLUMN IF NOT EXISTS "userId" TEXT;

-- Backfill: legacy rows belong to the primary owner (first VATER admin email).
UPDATE "VaterRssFeed" f
SET "userId" = u."id"
FROM "User" u
WHERE f."userId" IS NULL
  AND u."email" = 'jared@yourkchomes.com';

DROP INDEX IF EXISTS "VaterRssFeed_url_key";
CREATE UNIQUE INDEX IF NOT EXISTS "VaterRssFeed_userId_url_key" ON "VaterRssFeed"("userId", "url");
CREATE INDEX IF NOT EXISTS "VaterRssFeed_userId_idx" ON "VaterRssFeed"("userId");
