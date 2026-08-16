-- Multi-tenant isolation for Jelly Studio / /animate (2026-08-15).
--
-- 1. VaterAccount: per-user entitlements (tier + unmetered billing), so an
--    invite is a DB row instead of a Vercel env edit + redeploy. The env
--    allowlists stay as a bootstrap fallback in lib/admin-auth.ts.
-- 2. VaterPayment.userId: payments are per-tenant now that the render bill is
--    computed per user (lib/vater/billing/summary.ts).

CREATE TABLE IF NOT EXISTS "VaterAccount" (
    "userId"    TEXT NOT NULL,
    "tier"      TEXT NOT NULL DEFAULT 'public',
    "unmetered" BOOLEAN NOT NULL DEFAULT false,
    "invitedBy" TEXT,
    "notes"     TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VaterAccount_pkey" PRIMARY KEY ("userId")
);

CREATE INDEX IF NOT EXISTS "VaterAccount_tier_idx" ON "VaterAccount"("tier");

ALTER TABLE "VaterPayment" ADD COLUMN IF NOT EXISTS "userId" TEXT;

CREATE INDEX IF NOT EXISTS "VaterPayment_userId_createdAt_idx"
    ON "VaterPayment"("userId", "createdAt");
