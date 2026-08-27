-- Listing Studio by Jelly! — VaterAccount origin + license/agent profile (2026-08-27).
--
-- Purely additive: nullable or defaulted columns and one index. Nothing is
-- dropped, rewritten or constrained against existing rows, and every
-- statement is IF NOT EXISTS, so it is safe against a live database and safe
-- to run twice. Code deployed ahead of this degrades (probe
-- hasVaterAccountOriginColumns() in lib/vater/schema-probe.ts):
--   - GET /api/vater/me reports product 'jelly' and an empty agent profile
--   - PATCH /api/vater/me { agentProfile } and /api/vater/listing/verify-license
--     answer FEATURE_NOT_READY (503)
--   - signup provisioning skips the origin stamp (account still created)
--
-- Apply manually with the repo convention:
--   npx prisma db execute --file prisma/migrations/20260827_vater_account_origin_license/migration.sql --schema prisma/schema.prisma

ALTER TABLE "VaterAccount" ADD COLUMN IF NOT EXISTS "origin"            TEXT NOT NULL DEFAULT 'jelly';
ALTER TABLE "VaterAccount" ADD COLUMN IF NOT EXISTS "licenseState"      TEXT;
ALTER TABLE "VaterAccount" ADD COLUMN IF NOT EXISTS "licenseNumber"     TEXT;
ALTER TABLE "VaterAccount" ADD COLUMN IF NOT EXISTS "licenseStatus"     TEXT NOT NULL DEFAULT 'unverified';
ALTER TABLE "VaterAccount" ADD COLUMN IF NOT EXISTS "licenseeName"      TEXT;
ALTER TABLE "VaterAccount" ADD COLUMN IF NOT EXISTS "licenseProfession" TEXT;
ALTER TABLE "VaterAccount" ADD COLUMN IF NOT EXISTS "licenseExpiresAt"  TIMESTAMP(3);
ALTER TABLE "VaterAccount" ADD COLUMN IF NOT EXISTS "licenseVerifiedAt" TIMESTAMP(3);
ALTER TABLE "VaterAccount" ADD COLUMN IF NOT EXISTS "agentDisplayName"  TEXT;
ALTER TABLE "VaterAccount" ADD COLUMN IF NOT EXISTS "agentPhone"        TEXT;
ALTER TABLE "VaterAccount" ADD COLUMN IF NOT EXISTS "brokerName"        TEXT;
ALTER TABLE "VaterAccount" ADD COLUMN IF NOT EXISTS "brokerPhone"       TEXT;
ALTER TABLE "VaterAccount" ADD COLUMN IF NOT EXISTS "narMember"         BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "VaterAccount_origin_idx" ON "VaterAccount"("origin");
