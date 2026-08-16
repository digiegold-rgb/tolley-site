-- Prepaid credit ledger — Jelly Studio "Model B" billing (2026-08-15).
--
-- Append-only. Balance = SUM("deltaCents") per user; no cached balance column
-- (a cache is a second truth that drifts the first time a webhook retries).
--
-- Idempotency is enforced here, in the database, not by application care:
--   "stripeSessionId" UNIQUE  -> one purchase per Stripe Checkout session
--   "dedupeKey"       UNIQUE  -> one debit per finished video, one starter
--                                grant per user, one sweep per expired grant
--
-- Every statement is IF NOT EXISTS; nothing is dropped. Safe to run twice.

CREATE TABLE IF NOT EXISTS "VaterCreditLedger" (
    "id"                    TEXT NOT NULL,
    "userId"                TEXT NOT NULL,
    "deltaCents"            INTEGER NOT NULL,
    "kind"                  TEXT NOT NULL,
    "projectId"             TEXT,
    "stripeSessionId"       TEXT,
    "stripePaymentIntentId" TEXT,
    "expiresAt"             TIMESTAMP(3),
    "stillsOnly"            BOOLEAN NOT NULL DEFAULT false,
    "lineJson"              JSONB,
    "note"                  TEXT,
    "createdAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dedupeKey"             TEXT,

    CONSTRAINT "VaterCreditLedger_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "VaterCreditLedger_stripeSessionId_key"
    ON "VaterCreditLedger"("stripeSessionId");

CREATE UNIQUE INDEX IF NOT EXISTS "VaterCreditLedger_dedupeKey_key"
    ON "VaterCreditLedger"("dedupeKey");

CREATE INDEX IF NOT EXISTS "VaterCreditLedger_userId_idx"
    ON "VaterCreditLedger"("userId");

CREATE INDEX IF NOT EXISTS "VaterCreditLedger_userId_createdAt_idx"
    ON "VaterCreditLedger"("userId", "createdAt");

CREATE INDEX IF NOT EXISTS "VaterCreditLedger_projectId_idx"
    ON "VaterCreditLedger"("projectId");
