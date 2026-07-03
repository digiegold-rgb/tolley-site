-- Adds ShareLink table for /api/share + /s/<token> agent share infrastructure.
-- Purely additive — no existing rows touched. Safe to run on production.
--
-- Apply with:  psql "$DATABASE_URL" -f prisma/migrations/manual/2026-05-06-share-link.sql
-- Or:         npx prisma db execute --file prisma/migrations/manual/2026-05-06-share-link.sql --schema prisma/schema.prisma

CREATE TABLE IF NOT EXISTS "ShareLink" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "subsite" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "title" TEXT,
    "createdById" TEXT,
    "expiresAt" TIMESTAMP(3),
    "clickCount" INTEGER NOT NULL DEFAULT 0,
    "lastClickedAt" TIMESTAMP(3),
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShareLink_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ShareLink_token_key" ON "ShareLink"("token");
CREATE INDEX IF NOT EXISTS "ShareLink_subsite_createdAt_idx" ON "ShareLink"("subsite", "createdAt");
CREATE INDEX IF NOT EXISTS "ShareLink_createdById_idx" ON "ShareLink"("createdById");

ALTER TABLE "ShareLink"
    ADD CONSTRAINT "ShareLink_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
