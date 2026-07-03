-- Ruthann's Kitchen → paid SaaS: additive subscription columns on FoodHousehold
-- $39/yr annual plan, 30-day trial (was 7-day at launch; extended 2026-04-14), Stripe-backed
-- NEVER drop existing Food tables — Ruthann has real family data.

ALTER TABLE "FoodHousehold"
  ADD COLUMN "subscriptionStatus"   TEXT NOT NULL DEFAULT 'none',
  ADD COLUMN "stripeCustomerId"     TEXT,
  ADD COLUMN "stripeSubscriptionId" TEXT,
  ADD COLUMN "stripePriceId"        TEXT,
  ADD COLUMN "trialEndsAt"          TIMESTAMP(3),
  ADD COLUMN "currentPeriodEnd"     TIMESTAMP(3),
  ADD COLUMN "cancelAtPeriodEnd"    BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX "FoodHousehold_stripeCustomerId_key"     ON "FoodHousehold"("stripeCustomerId");
CREATE UNIQUE INDEX "FoodHousehold_stripeSubscriptionId_key" ON "FoodHousehold"("stripeSubscriptionId");
CREATE INDEX        "FoodHousehold_subscriptionStatus_idx"   ON "FoodHousehold"("subscriptionStatus");
CREATE INDEX        "FoodHousehold_stripeCustomerId_idx"     ON "FoodHousehold"("stripeCustomerId");

-- Grandfather Ruthann's existing household as paid (founder account, never pays)
-- Matches the userId of the existing single household row. No-op if household doesn't exist yet.
UPDATE "FoodHousehold"
SET "subscriptionStatus" = 'active'
WHERE "subscriptionStatus" = 'none';
