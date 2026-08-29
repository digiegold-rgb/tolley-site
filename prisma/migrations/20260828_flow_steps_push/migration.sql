-- Stepped approval flow + browser push (2026-08-28). ADDITIVE + IDEMPOTENT.
-- flowStep/flowStepAt = last step the user reached (lib/vater/create-steps.ts);
-- approvalExpiresAt = 7-day gate on awaiting_script_approval / awaiting_engine;
-- variationJson = last "Rewrite — make it more different" request;
-- notified*At = once-only stamps for email/push.
-- Apply:
--   cd ~/tolley-site && npx prisma db execute \
--     --file prisma/migrations/20260828_flow_steps_push/migration.sql \
--     --schema prisma/schema.prisma
ALTER TABLE "YouTubeProject" ADD COLUMN IF NOT EXISTS "flowStep" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "YouTubeProject" ADD COLUMN IF NOT EXISTS "flowStepAt" TIMESTAMP(3);
ALTER TABLE "YouTubeProject" ADD COLUMN IF NOT EXISTS "approvalExpiresAt" TIMESTAMP(3);
ALTER TABLE "YouTubeProject" ADD COLUMN IF NOT EXISTS "variationJson" JSONB;
ALTER TABLE "YouTubeProject" ADD COLUMN IF NOT EXISTS "notifiedScriptReadyAt" TIMESTAMP(3);
ALTER TABLE "YouTubeProject" ADD COLUMN IF NOT EXISTS "notifiedReadyAt" TIMESTAMP(3);
ALTER TABLE "YouTubeProject" ADD COLUMN IF NOT EXISTS "notifiedQaAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "YouTubeProject_userId_status_idx" ON "YouTubeProject"("userId", "status");
CREATE INDEX IF NOT EXISTS "YouTubeProject_userId_updatedAt_idx" ON "YouTubeProject"("userId", "updatedAt");
CREATE INDEX IF NOT EXISTS "YouTubeProject_status_approvalExpiresAt_idx" ON "YouTubeProject"("status", "approvalExpiresAt");

-- Rows already parked at the gate before this shipped get the same 7-day clock
-- from the moment of migration (a NULL would never expire).
UPDATE "YouTubeProject"
   SET "approvalExpiresAt" = now() + interval '7 days'
 WHERE "status" = 'awaiting_script_approval' AND "approvalExpiresAt" IS NULL;

CREATE TABLE IF NOT EXISTS "VaterPushSubscription" (
  "id"        TEXT PRIMARY KEY,
  "userId"    TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "endpoint"  TEXT NOT NULL UNIQUE,
  "p256dh"    TEXT NOT NULL,
  "auth"      TEXT NOT NULL,
  "userAgent" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "VaterPushSubscription_userId_idx" ON "VaterPushSubscription"("userId");
