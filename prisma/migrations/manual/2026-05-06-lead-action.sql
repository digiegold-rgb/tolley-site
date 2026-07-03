-- Adds LeadAction table for transactional agent submissions (book_trailer,
-- request_quote, etc.) with receipt tokens so an agent can follow-up via
-- GET /api/lead/<token>. Distinct from EmailLead (which stays for "subscribe"
-- captures and is unique per email).
--
-- Apply with:
--   npx prisma db execute --file prisma/migrations/manual/2026-05-06-lead-action.sql --schema prisma/schema.prisma

CREATE TABLE IF NOT EXISTS "LeadAction" (
    "id"              TEXT NOT NULL,
    "receiptToken"    TEXT NOT NULL,
    "subsite"         TEXT NOT NULL,
    "action"          TEXT NOT NULL,
    "email"           TEXT,
    "name"            TEXT,
    "phone"           TEXT,
    "structured"      JSONB,
    "status"          TEXT NOT NULL DEFAULT 'new',
    "statusNote"      TEXT,
    "statusUpdatedAt" TIMESTAMP(3),
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LeadAction_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "LeadAction_receiptToken_key" ON "LeadAction"("receiptToken");
CREATE INDEX IF NOT EXISTS "LeadAction_subsite_action_createdAt_idx" ON "LeadAction"("subsite", "action", "createdAt");
CREATE INDEX IF NOT EXISTS "LeadAction_status_createdAt_idx" ON "LeadAction"("status", "createdAt");
