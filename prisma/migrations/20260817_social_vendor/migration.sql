-- Social publishing via aggregator (Zernio) — 2026-08-17.
-- Users can now connect TikTok/IG/FB/Pinterest/X/LinkedIn to their OWN
-- accounts through the vendor's hosted OAuth. YouTube stays native.
-- ADDITIVE + IDEMPOTENT.
-- Apply:
--   cd ~/tolley-site && npx prisma db execute \
--     --file prisma/migrations/20260817_social_vendor/migration.sql \
--     --schema prisma/schema.prisma
ALTER TABLE "SocialAccount" ADD COLUMN IF NOT EXISTS "provider" TEXT NOT NULL DEFAULT 'native';
ALTER TABLE "SocialAccount" ADD COLUMN IF NOT EXISTS "externalAccountId" TEXT;
ALTER TABLE "SocialAccount" ADD COLUMN IF NOT EXISTS "username" TEXT;
ALTER TABLE "SocialAccount" ADD COLUMN IF NOT EXISTS "profileUrl" TEXT;
CREATE INDEX IF NOT EXISTS "SocialAccount_provider_externalAccountId_idx" ON "SocialAccount"("provider", "externalAccountId");

CREATE TABLE IF NOT EXISTS "VaterSocialProfile" (
  "id"                TEXT PRIMARY KEY,
  "userId"            TEXT NOT NULL UNIQUE REFERENCES "User"("id") ON DELETE CASCADE,
  "vendor"            TEXT NOT NULL DEFAULT 'zernio',
  "externalProfileId" TEXT NOT NULL,
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "VaterSocialProfile_vendor_externalProfileId_idx" ON "VaterSocialProfile"("vendor", "externalProfileId");

CREATE TABLE IF NOT EXISTS "VaterSocialPost" (
  "id"             TEXT PRIMARY KEY,
  "userId"         TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "projectId"      TEXT NOT NULL,
  "vendor"         TEXT NOT NULL DEFAULT 'zernio',
  "externalPostId" TEXT NOT NULL UNIQUE,
  "platforms"      JSONB NOT NULL,
  "caption"        TEXT,
  "status"         TEXT NOT NULL DEFAULT 'scheduled',
  "scheduledFor"   TIMESTAMP(3),
  "publishedAt"    TIMESTAMP(3),
  "lastError"      TEXT,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "VaterSocialPost_userId_createdAt_idx" ON "VaterSocialPost"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "VaterSocialPost_projectId_idx" ON "VaterSocialPost"("projectId");
