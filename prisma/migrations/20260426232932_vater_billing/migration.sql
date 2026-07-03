-- Vater Studio billing models (2026-04-26)
-- Pure dollar-denominated, no credits. Mirrors Claude.ai usage UX.

-- VaterSubscription: $288/mo subscription state, separate from Food/Leads.
CREATE TABLE "VaterSubscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,
    "stripePriceId" TEXT,
    "stripeCreditGrantId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'trialing',
    "currentPeriodStart" TIMESTAMP(3),
    "currentPeriodEnd" TIMESTAMP(3),
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "trialEndedAt" TIMESTAMP(3),
    "trialConvertedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VaterSubscription_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "VaterSubscription_userId_key" ON "VaterSubscription"("userId");
CREATE UNIQUE INDEX "VaterSubscription_stripeCustomerId_key" ON "VaterSubscription"("stripeCustomerId");
CREATE UNIQUE INDEX "VaterSubscription_stripeSubscriptionId_key" ON "VaterSubscription"("stripeSubscriptionId");
CREATE INDEX "VaterSubscription_status_idx" ON "VaterSubscription"("status");

ALTER TABLE "VaterSubscription" ADD CONSTRAINT "VaterSubscription_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- VaterUsage: immutable ledger of every chargeable action (mirrors Stripe InvoiceItems).
CREATE TABLE "VaterUsage" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "tier" TEXT,
    "costCents" INTEGER NOT NULL,
    "description" TEXT,
    "projectId" TEXT,
    "ts" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "stripeInvoiceItemId" TEXT,
    "idempotencyKey" TEXT,

    CONSTRAINT "VaterUsage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "VaterUsage_stripeInvoiceItemId_key" ON "VaterUsage"("stripeInvoiceItemId");
CREATE UNIQUE INDEX "VaterUsage_idempotencyKey_key" ON "VaterUsage"("idempotencyKey");
CREATE INDEX "VaterUsage_userId_ts_idx" ON "VaterUsage"("userId", "ts");
CREATE INDEX "VaterUsage_userId_action_ts_idx" ON "VaterUsage"("userId", "action", "ts");
CREATE INDEX "VaterUsage_projectId_idx" ON "VaterUsage"("projectId");

ALTER TABLE "VaterUsage" ADD CONSTRAINT "VaterUsage_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- VaterTrialUsage: free-tier cap counters (3 transcripts, 1 scene, 1 animation).
CREATE TABLE "VaterTrialUsage" (
    "userId" TEXT NOT NULL,
    "transcripts" INTEGER NOT NULL DEFAULT 0,
    "scenes" INTEGER NOT NULL DEFAULT 0,
    "animations" INTEGER NOT NULL DEFAULT 0,
    "firstUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "capHitAt" TIMESTAMP(3),

    CONSTRAINT "VaterTrialUsage_pkey" PRIMARY KEY ("userId")
);

ALTER TABLE "VaterTrialUsage" ADD CONSTRAINT "VaterTrialUsage_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- VaterMonthlyLimit: user-set monthly spending cap (default $500/mo).
CREATE TABLE "VaterMonthlyLimit" (
    "userId" TEXT NOT NULL,
    "limitCents" INTEGER NOT NULL DEFAULT 50000,
    "periodStart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usedCents" INTEGER NOT NULL DEFAULT 0,
    "raisedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VaterMonthlyLimit_pkey" PRIMARY KEY ("userId")
);

ALTER TABLE "VaterMonthlyLimit" ADD CONSTRAINT "VaterMonthlyLimit_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
