-- KC Motivated Seller Digest — self-serve subscriber table.
-- Fully additive: one new table + indexes + the founding row (Jared, who was
-- previously hardcoded in lib/leads/digest-subscribers.ts as "cordless-self").

CREATE TABLE IF NOT EXISTS "DigestSubscriber" (
  "id"                   TEXT NOT NULL,
  "name"                 TEXT NOT NULL,
  "email"                TEXT NOT NULL,
  "farmZips"             TEXT[],
  "status"               TEXT NOT NULL DEFAULT 'pending',
  "stripeCustomerId"     TEXT,
  "stripeSubscriptionId" TEXT,
  "customScriptTemplate" TEXT,
  "unsubscribeToken"     TEXT NOT NULL,
  "joinedAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"            TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DigestSubscriber_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "DigestSubscriber_email_key"
  ON "DigestSubscriber"("email");

CREATE UNIQUE INDEX IF NOT EXISTS "DigestSubscriber_stripeCustomerId_key"
  ON "DigestSubscriber"("stripeCustomerId");

CREATE UNIQUE INDEX IF NOT EXISTS "DigestSubscriber_stripeSubscriptionId_key"
  ON "DigestSubscriber"("stripeSubscriptionId");

CREATE UNIQUE INDEX IF NOT EXISTS "DigestSubscriber_unsubscribeToken_key"
  ON "DigestSubscriber"("unsubscribeToken");

CREATE INDEX IF NOT EXISTS "DigestSubscriber_status_idx"
  ON "DigestSubscriber"("status");

-- Founding row: Jared has received the digest since 2026-05-05. Fixed id so
-- the old hardcoded "cordless-self" id (used in logs) stays stable. No Stripe
-- ids — he doesn't pay himself. ON CONFLICT DO NOTHING keeps this re-runnable.
INSERT INTO "DigestSubscriber"
  ("id", "name", "email", "farmZips", "status", "unsubscribeToken", "joinedAt", "updatedAt")
VALUES (
  'cordless-self',
  'Jared Tolley',
  'digiegold@gmail.com',
  ARRAY['64052','64055','64056','64057','64014'],
  'active',
  'dgst-cordless-self-f81b2c97a4e3',
  TIMESTAMP '2026-05-05 00:00:00',
  CURRENT_TIMESTAMP
)
ON CONFLICT DO NOTHING;
