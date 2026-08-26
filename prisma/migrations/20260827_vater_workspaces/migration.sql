-- Jelly Studio workspaces ("tabs") — 2026-08-27.
--
-- One new table, nothing dropped, nothing rewritten, every statement is
-- IF NOT EXISTS: safe against a live database and safe to run twice.
--
-- A tab is a hidden User row (email NULL, no credentials) linked to the real
-- login by this table. auth.ts swaps session.user.id to the tab's User when
-- the signed `jelly_ws` cookie names it, so every userId-keyed table is
-- per-tab without touching it. The primary tab is the login itself
-- (ownerUserId == userId) and is inserted lazily on first list.
--
-- What stays dormant until this runs (all degrade, none 500):
--   - the tab strip in /animate renders nothing (single implicit tab)
--   - /api/vater/workspaces answers FEATURE_NOT_READY (503)
--   - a stale jelly_ws cookie is ignored → the login's own studio

CREATE TABLE IF NOT EXISTS "VaterWorkspace" (
    "id"          TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "userId"      TEXT NOT NULL,
    "name"        TEXT NOT NULL,
    "sortOrder"   INTEGER NOT NULL DEFAULT 0,
    "archivedAt"  TIMESTAMP(3),
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VaterWorkspace_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "VaterWorkspace_userId_key"
    ON "VaterWorkspace"("userId");

CREATE INDEX IF NOT EXISTS "VaterWorkspace_ownerUserId_sortOrder_idx"
    ON "VaterWorkspace"("ownerUserId", "sortOrder");
