-- Vater pay-per-video billing + B2B video track + DB rate limiting.
-- Fully additive — nullable columns + one new table.

-- VaterSubscription: card-on-file fields (pay-per-video model)
ALTER TABLE "VaterSubscription"
  ADD COLUMN IF NOT EXISTS "defaultPaymentMethodId" TEXT,
  ADD COLUMN IF NOT EXISTS "cardBrand"              TEXT,
  ADD COLUMN IF NOT EXISTS "cardLast4"              TEXT,
  ADD COLUMN IF NOT EXISTS "cardExpMonth"           INTEGER,
  ADD COLUMN IF NOT EXISTS "cardExpYear"            INTEGER,
  ADD COLUMN IF NOT EXISTS "delinquentAt"           TIMESTAMP(3);

-- VaterUsage: invoice stamping (unbilled accrual = invoiceItem set, invoice null)
ALTER TABLE "VaterUsage"
  ADD COLUMN IF NOT EXISTS "stripeInvoiceId" TEXT;

CREATE INDEX IF NOT EXISTS "VaterUsage_userId_stripeInvoiceId_idx"
  ON "VaterUsage"("userId", "stripeInvoiceId");

-- GrowthLead: B2B demo video columns
ALTER TABLE "GrowthLead"
  ADD COLUMN IF NOT EXISTS "videoUrl"      TEXT,
  ADD COLUMN IF NOT EXISTS "videoAssetUrl" TEXT;

-- DB-backed rate limiting / locks
CREATE TABLE IF NOT EXISTS "RateLimitBucket" (
  "key"         TEXT NOT NULL,
  "windowStart" TIMESTAMP(3) NOT NULL,
  "count"       INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "RateLimitBucket_pkey" PRIMARY KEY ("key")
);

-- YouTubeProject: tenant scoping (legacy rows stay NULL = admin-only)
ALTER TABLE "YouTubeProject"
  ADD COLUMN IF NOT EXISTS "userId" TEXT;

CREATE INDEX IF NOT EXISTS "YouTubeProject_userId_idx" ON "YouTubeProject"("userId");
