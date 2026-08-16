-- Jelly Studio click-wrap (2026-08-15).
--
-- Records which version of the studio legal set (Terms + Privacy + Beta
-- Addendum, lib/legal-animate.ts TOS_VERSION) an account accepted, and when.
-- app/api/auth/register/route.ts writes these with raw SQL inside a try/catch,
-- so the signup route keeps working on any environment where this migration
-- has not been applied yet.
--
-- showcaseOptOut backs the promotional-license opt-out promised in Terms § 7:
-- false (the default) means we may use that account's inputs/outputs in
-- showcases and marketing; true means we stop, for all future marketing.
--
-- Apply manually with the repo convention:
--   npx prisma db execute --file prisma/migrations/20260815_animate_terms/migration.sql --schema prisma/schema.prisma

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "termsAcceptedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "termsVersion" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "showcaseOptOut" BOOLEAN NOT NULL DEFAULT false;
