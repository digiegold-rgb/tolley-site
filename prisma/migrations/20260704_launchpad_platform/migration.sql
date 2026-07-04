-- The Launchpad v2 platform (tolley.io/sales → /biz/<slug>).
-- Three net-new tables: Operator (a person Jared took on), Storefront (their
-- public /biz page), LaunchpadSale (a completed sale through that page).
-- Fully additive — CREATE TABLE IF NOT EXISTS + IF NOT EXISTS indexes, no
-- existing table or row is touched. Mirrors the 20260612_digest_subscriber
-- pattern so a re-run is a no-op.

-- ── Operator ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "Operator" (
  "id"              TEXT NOT NULL,
  "slug"            TEXT NOT NULL,
  "name"            TEXT NOT NULL,
  "email"           TEXT,
  "phone"           TEXT,
  "status"          TEXT NOT NULL DEFAULT 'pending',
  "userId"          TEXT,
  "termsAcceptedAt" TIMESTAMP(3),
  "approvedAt"      TIMESTAMP(3),
  "leadActionId"    TEXT,
  "notes"           TEXT,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Operator_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Operator_slug_key"
  ON "Operator"("slug");

CREATE INDEX IF NOT EXISTS "Operator_status_createdAt_idx"
  ON "Operator"("status", "createdAt");

CREATE INDEX IF NOT EXISTS "Operator_userId_idx"
  ON "Operator"("userId");

-- ── Storefront ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "Storefront" (
  "id"               TEXT NOT NULL,
  "operatorId"       TEXT NOT NULL,
  "slug"             TEXT NOT NULL,
  "businessName"     TEXT NOT NULL,
  "category"         TEXT NOT NULL DEFAULT 'generic',
  "tagline"          TEXT,
  "about"            TEXT,
  "city"             TEXT,
  "phone"            TEXT,
  "offerings"        JSONB NOT NULL DEFAULT '[]',
  "published"        BOOLEAN NOT NULL DEFAULT true,
  "sellingEnabled"   BOOLEAN NOT NULL DEFAULT false,
  "stripeProductIds" JSONB,
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Storefront_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Storefront_operatorId_key"
  ON "Storefront"("operatorId");

CREATE UNIQUE INDEX IF NOT EXISTS "Storefront_slug_key"
  ON "Storefront"("slug");

CREATE INDEX IF NOT EXISTS "Storefront_published_createdAt_idx"
  ON "Storefront"("published", "createdAt");

-- ── LaunchpadSale ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "LaunchpadSale" (
  "id"              TEXT NOT NULL,
  "storefrontId"    TEXT NOT NULL,
  "offeringName"    TEXT NOT NULL,
  "amountCents"     INTEGER NOT NULL,
  "kind"            TEXT NOT NULL,
  "stripeSessionId" TEXT NOT NULL,
  "buyerEmail"      TEXT,
  "buyerName"       TEXT,
  "buyerPhone"      TEXT,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LaunchpadSale_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "LaunchpadSale_stripeSessionId_key"
  ON "LaunchpadSale"("stripeSessionId");

CREATE INDEX IF NOT EXISTS "LaunchpadSale_storefrontId_createdAt_idx"
  ON "LaunchpadSale"("storefrontId", "createdAt");

-- ── Foreign keys (wrapped so a re-run doesn't error on an existing constraint) ──
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Storefront_operatorId_fkey'
  ) THEN
    ALTER TABLE "Storefront"
      ADD CONSTRAINT "Storefront_operatorId_fkey"
      FOREIGN KEY ("operatorId") REFERENCES "Operator"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'LaunchpadSale_storefrontId_fkey'
  ) THEN
    ALTER TABLE "LaunchpadSale"
      ADD CONSTRAINT "LaunchpadSale_storefrontId_fkey"
      FOREIGN KEY ("storefrontId") REFERENCES "Storefront"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
