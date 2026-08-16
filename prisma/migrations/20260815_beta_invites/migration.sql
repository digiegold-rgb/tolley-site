-- Jelly Studio beta Phase 3 — invites, password reset, view-as, system log.
-- 2026-08-15.
--
-- 100% ADDITIVE and 100% IDEMPOTENT: every statement is IF NOT EXISTS, no
-- column is dropped, no type is changed, no data is rewritten. Safe to apply
-- while the current production code is live, and safe to run twice.
--
--   1. User.betaInviteId    — which invite this account was created from
--   2. User.sessionVersion  — bumped on password reset to kill live JWTs
--   3. BetaInvite           — the invite codes themselves
--   4. AdminImpersonation   — audit trail for "view as user"
--   5. VaterEvent           — append-only customer-visible system log
--
-- Apply:
--   cd ~/tolley-site && npx prisma db execute \
--     --file prisma/migrations/20260815_beta_invites/migration.sql \
--     --schema prisma/schema.prisma
-- or (with the seed/backfill steps):
--   npx tsx scripts/apply-jelly-tenancy-2026-08-15.ts --apply

-- 1 + 2 ────────────────────────────────────────────────────────────────────
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "betaInviteId" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "sessionVersion" INTEGER NOT NULL DEFAULT 0;

-- 3 ────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "BetaInvite" (
    "id"        TEXT NOT NULL,
    "code"      TEXT NOT NULL,
    "email"     TEXT,
    "maxUses"   INTEGER NOT NULL DEFAULT 1,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3),
    "createdBy" TEXT,
    "note"      TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BetaInvite_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "BetaInvite_code_key" ON "BetaInvite"("code");
CREATE INDEX IF NOT EXISTS "BetaInvite_email_idx" ON "BetaInvite"("email");
CREATE INDEX IF NOT EXISTS "BetaInvite_createdAt_idx" ON "BetaInvite"("createdAt");

-- 4 ────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "AdminImpersonation" (
    "id"           TEXT NOT NULL,
    "adminEmail"   TEXT NOT NULL,
    "targetUserId" TEXT NOT NULL,
    "path"         TEXT,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminImpersonation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AdminImpersonation_targetUserId_createdAt_idx"
    ON "AdminImpersonation"("targetUserId", "createdAt");
CREATE INDEX IF NOT EXISTS "AdminImpersonation_createdAt_idx"
    ON "AdminImpersonation"("createdAt");

-- 5 ────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "VaterEvent" (
    "id"         TEXT NOT NULL,
    "userId"     TEXT NOT NULL,
    "projectId"  TEXT,
    "jobId"      TEXT,
    "kind"       TEXT NOT NULL,
    "level"      TEXT NOT NULL DEFAULT 'info',
    "message"    TEXT NOT NULL,
    "dataJson"   JSONB,
    "durationMs" INTEGER,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VaterEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "VaterEvent_userId_createdAt_idx"
    ON "VaterEvent"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "VaterEvent_projectId_createdAt_idx"
    ON "VaterEvent"("projectId", "createdAt");
CREATE INDEX IF NOT EXISTS "VaterEvent_createdAt_idx"
    ON "VaterEvent"("createdAt");
