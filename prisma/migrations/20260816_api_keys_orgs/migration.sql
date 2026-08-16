-- Public API v1 + team seats — Jelly Studio (2026-08-16).
--
-- Three new tables and one new nullable column. Nothing is dropped, nothing is
-- rewritten, every statement is IF NOT EXISTS: safe against a live database and
-- safe to run twice.
--
-- What stays dormant until this runs (all degrade, none 500):
--   - /animate "API Keys" and "Team" screens report FEATURE_NOT_READY (503)
--   - /api/v1/* returns 503 instead of 401 (there is no key store to check)
--   - project visibility is exactly today's behaviour: owner-only
--
-- ── VaterApiKey ────────────────────────────────────────────────────────────
-- The plaintext key is never stored. "keyHash" is sha256(plaintext) and is the
-- lookup column, so it is UNIQUE — a hash collision would be two keys
-- authenticating as each other. "prefix" is the non-secret display fragment.
-- "revokedAt" disables a key without deleting the row, because a revoked key
-- still has projects and webhook deliveries attributed to it.

CREATE TABLE IF NOT EXISTS "VaterApiKey" (
    "id"         TEXT NOT NULL,
    "userId"     TEXT NOT NULL,
    "name"       TEXT NOT NULL,
    "keyHash"    TEXT NOT NULL,
    "prefix"     TEXT NOT NULL,
    "webhookUrl" TEXT,
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt"  TIMESTAMP(3),
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VaterApiKey_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "VaterApiKey_keyHash_key"
    ON "VaterApiKey"("keyHash");

CREATE INDEX IF NOT EXISTS "VaterApiKey_userId_idx"
    ON "VaterApiKey"("userId");

CREATE INDEX IF NOT EXISTS "VaterApiKey_prefix_idx"
    ON "VaterApiKey"("prefix");

-- ── VaterOrg / VaterOrgMember ──────────────────────────────────────────────
-- A visibility grant layered over tenant isolation. project."userId" keeps
-- meaning "who paid"; org membership only decides who else may open it.
--
-- The UNIQUE(orgId, userId) is the whole concurrency story for seat joins: the
-- lazy invite-join in lib/vater/org-access.ts is an ON CONFLICT DO NOTHING
-- insert, so two tabs racing to load /animate cannot create a duplicate seat.

CREATE TABLE IF NOT EXISTS "VaterOrg" (
    "id"          TEXT NOT NULL,
    "name"        TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VaterOrg_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "VaterOrg_ownerUserId_idx"
    ON "VaterOrg"("ownerUserId");

CREATE TABLE IF NOT EXISTS "VaterOrgMember" (
    "id"        TEXT NOT NULL,
    "orgId"     TEXT NOT NULL,
    "userId"    TEXT NOT NULL,
    "role"      TEXT NOT NULL DEFAULT 'viewer',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VaterOrgMember_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "VaterOrgMember_orgId_userId_key"
    ON "VaterOrgMember"("orgId", "userId");

CREATE INDEX IF NOT EXISTS "VaterOrgMember_userId_idx"
    ON "VaterOrgMember"("userId");

CREATE INDEX IF NOT EXISTS "VaterOrgMember_orgId_idx"
    ON "VaterOrgMember"("orgId");

-- ── BetaInvite.orgId ───────────────────────────────────────────────────────
-- Set when a team owner invites a seat by email. Redeeming that code drops the
-- new account into the org (lazily, on first /animate load). NULL on every
-- existing invite, which is the pre-teams behaviour.

ALTER TABLE "BetaInvite" ADD COLUMN IF NOT EXISTS "orgId" TEXT;

CREATE INDEX IF NOT EXISTS "BetaInvite_orgId_idx"
    ON "BetaInvite"("orgId");
