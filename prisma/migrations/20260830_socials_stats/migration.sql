-- Jelly Studio Socials — daily channel + post snapshots (2026-08-30).
--
-- ADDITIVE + IDEMPOTENT. Two new tables, one optional column on
-- VaterSocialPost. Nothing dropped, nothing rewritten, every statement is
-- IF NOT EXISTS: safe against a live database and safe to run twice.
--
-- Code deploys on `git push main`; this SQL is applied by hand
-- (scripts/apply-socials-stats-2026-08-30.ts). Until it runs, every reader
-- probes for the tables and degrades (empty stats / skipped collector) —
-- never 500s.
--
-- BigInt columns hold YouTube-scale view counts. API routes MUST convert
-- to Number before NextResponse.json (Prisma BigInt is not JSON-serializable).

ALTER TABLE "VaterSocialPost" ADD COLUMN IF NOT EXISTS "batchId" TEXT;

CREATE INDEX IF NOT EXISTS "VaterSocialPost_userId_batchId_idx"
    ON "VaterSocialPost"("userId", "batchId");

CREATE TABLE IF NOT EXISTS "SocialChannelStat" (
    "id"           TEXT NOT NULL,
    "userId"       TEXT NOT NULL,
    "platform"     TEXT NOT NULL,
    "day"          TIMESTAMP(3) NOT NULL,
    "followers"    BIGINT,
    "views"        BIGINT,
    "likes"        BIGINT,
    "comments"     BIGINT,
    "shares"       BIGINT,
    "impressions"  BIGINT,
    "reach"        BIGINT,
    "watchTimeSec" BIGINT,
    "pulledAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SocialChannelStat_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "SocialChannelStat_userId_platform_day_key"
    ON "SocialChannelStat"("userId", "platform", "day");

CREATE INDEX IF NOT EXISTS "SocialChannelStat_userId_day_idx"
    ON "SocialChannelStat"("userId", "day");

CREATE INDEX IF NOT EXISTS "SocialChannelStat_pulledAt_idx"
    ON "SocialChannelStat"("pulledAt");

CREATE INDEX IF NOT EXISTS "SocialChannelStat_platform_day_idx"
    ON "SocialChannelStat"("platform", "day");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'SocialChannelStat_userId_fkey'
  ) THEN
    ALTER TABLE "SocialChannelStat"
      ADD CONSTRAINT "SocialChannelStat_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "SocialPostStat" (
    "id"           TEXT NOT NULL,
    "postId"       TEXT NOT NULL,
    "day"          TIMESTAMP(3) NOT NULL,
    "views"        BIGINT,
    "likes"        BIGINT,
    "comments"     BIGINT,
    "shares"       BIGINT,
    "impressions"  BIGINT,
    "reach"        BIGINT,
    "watchTimeSec" BIGINT,
    "pulledAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SocialPostStat_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "SocialPostStat_postId_day_key"
    ON "SocialPostStat"("postId", "day");

CREATE INDEX IF NOT EXISTS "SocialPostStat_day_idx"
    ON "SocialPostStat"("day");

CREATE INDEX IF NOT EXISTS "SocialPostStat_pulledAt_idx"
    ON "SocialPostStat"("pulledAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'SocialPostStat_postId_fkey'
  ) THEN
    ALTER TABLE "SocialPostStat"
      ADD CONSTRAINT "SocialPostStat_postId_fkey"
      FOREIGN KEY ("postId") REFERENCES "VaterSocialPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
