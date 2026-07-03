-- W/D Stripe automation: subscription sync, dunning, 1-click messaging.
-- Fully additive — new nullable/defaulted columns + one new table.

-- WdClient: Stripe subscription state + approval/dunning bookkeeping
ALTER TABLE "WdClient"
  ADD COLUMN IF NOT EXISTS "stripeSubscriptionId"  TEXT,
  ADD COLUMN IF NOT EXISTS "subscriptionStatus"    TEXT,
  ADD COLUMN IF NOT EXISTS "currentPeriodEnd"      TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "cancelAtPeriodEnd"     BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "lastPaymentStatus"     TEXT,
  ADD COLUMN IF NOT EXISTS "pendingApproval"       BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "dunningStage"          INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "reminderSentForPeriod" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "WdClient_stripeCustomerId_idx" ON "WdClient"("stripeCustomerId");
CREATE INDEX IF NOT EXISTS "WdClient_stripeSubscriptionId_idx" ON "WdClient"("stripeSubscriptionId");

-- WdPayment: Stripe linkage
ALTER TABLE "WdPayment"
  ADD COLUMN IF NOT EXISTS "source"          TEXT NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS "stripeInvoiceId" TEXT,
  ADD COLUMN IF NOT EXISTS "paidAt"          TIMESTAMP(3);

CREATE UNIQUE INDEX IF NOT EXISTS "WdPayment_stripeInvoiceId_key" ON "WdPayment"("stripeInvoiceId");

-- WdMessage: outbound/inbound customer messages (drafts → 1-click send)
CREATE TABLE IF NOT EXISTS "WdMessage" (
    "id"          TEXT NOT NULL,
    "clientId"    TEXT,
    "phone"       TEXT,
    "channel"     TEXT NOT NULL DEFAULT 'sms',
    "direction"   TEXT NOT NULL DEFAULT 'outbound',
    "kind"        TEXT NOT NULL,
    "status"      TEXT NOT NULL DEFAULT 'draft',
    "subject"     TEXT,
    "body"        TEXT NOT NULL,
    "aiGenerated" BOOLEAN NOT NULL DEFAULT false,
    "meta"        JSONB,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt"      TIMESTAMP(3),
    CONSTRAINT "WdMessage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "WdMessage_status_idx" ON "WdMessage"("status");
CREATE INDEX IF NOT EXISTS "WdMessage_clientId_idx" ON "WdMessage"("clientId");
CREATE INDEX IF NOT EXISTS "WdMessage_direction_status_idx" ON "WdMessage"("direction", "status");

DO $$ BEGIN
  ALTER TABLE "WdMessage"
    ADD CONSTRAINT "WdMessage_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "WdClient"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
