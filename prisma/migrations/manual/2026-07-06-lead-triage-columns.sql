-- EmailLead + ClientPortalSignup were write-only tables (CTO audit 2026-07-06,
-- Tier 1 #2/#3). Add triage columns so they surface in the /hq Inbox with the
-- same status ladder as LeadAction.
ALTER TABLE "EmailLead" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'new';
ALTER TABLE "EmailLead" ADD COLUMN IF NOT EXISTS "statusNote" TEXT;
ALTER TABLE "EmailLead" ADD COLUMN IF NOT EXISTS "statusUpdatedAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "EmailLead_status_idx" ON "EmailLead"("status");

ALTER TABLE "ClientPortalSignup" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'new';
ALTER TABLE "ClientPortalSignup" ADD COLUMN IF NOT EXISTS "statusNote" TEXT;
ALTER TABLE "ClientPortalSignup" ADD COLUMN IF NOT EXISTS "statusUpdatedAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "ClientPortalSignup_status_idx" ON "ClientPortalSignup"("status");
