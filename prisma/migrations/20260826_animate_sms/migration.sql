-- Jelly Studio A2P SMS consent (2026-08-26).
--
-- Optional "text me when my film is ready" account texts. The live-site
-- checkbox on /animate and the signed-in Account texts panel write these.
-- Separate from Wash & Dry SMS (913-600-7508 / campaign CQG8RGM).
--
-- Apply manually with the repo convention:
--   npx prisma db execute --file prisma/migrations/20260826_animate_sms/migration.sql --schema prisma/schema.prisma

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "animateSmsOptIn" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "animateSmsPhone" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "animateSmsOptedInAt" TIMESTAMP(3);
