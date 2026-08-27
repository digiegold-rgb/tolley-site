-- Listing Studio by Jelly! — VaterListingJob (2026-08-27).
--
-- ⚠️ Named VaterListingJob: "ListingJob" is already the SHOP cross-listing
-- queue (fb_marketplace drainers) — a different product, never touched here.
--
-- One new table, nothing dropped, nothing rewritten, every statement is
-- IF NOT EXISTS: safe against a live database and safe to run twice.
--
-- What stays dormant until this runs (all degrade, none 500):
--   - every /api/vater/listing/* route answers FEATURE_NOT_READY (503)
--   - the Listing Studio wizard shows its "not ready" card
--   - /realestateanimated/proof/<token> 404s
-- Probe: hasVaterListingJobTable() in lib/vater/schema-probe.ts.
--
-- Apply manually with the repo convention:
--   npx prisma db execute --file prisma/migrations/20260827_vater_listing_jobs/migration.sql --schema prisma/schema.prisma

CREATE TABLE IF NOT EXISTS "VaterListingJob" (
    "id"                    TEXT NOT NULL,
    "userId"                TEXT NOT NULL,
    "sku"                   TEXT,
    "status"                TEXT NOT NULL DEFAULT 'draft',
    "step"                  INTEGER NOT NULL DEFAULT 1,
    "sourceKind"            TEXT NOT NULL DEFAULT 'upload',
    "sourceImageUrls"       TEXT[] DEFAULT ARRAY[]::TEXT[],
    "address"               TEXT,
    "city"                  TEXT,
    "state"                 TEXT,
    "zip"                   TEXT,
    "lat"                   DOUBLE PRECISION,
    "lng"                   DOUBLE PRECISION,
    "beds"                  INTEGER,
    "baths"                 DOUBLE PRECISION,
    "sqft"                  INTEGER,
    "features"              JSONB NOT NULL DEFAULT '[]',
    "dictationRaw"          TEXT,
    "roomType"              TEXT,
    "style"                 TEXT,
    "look"                  TEXT,
    "engine"                TEXT NOT NULL DEFAULT 'seedance',
    "lane"                  TEXT NOT NULL DEFAULT 'social',
    "reel"                  BOOLEAN NOT NULL DEFAULT false,
    "promptJson"            JSONB,
    "complianceJson"        JSONB,
    "stagedStillUrl"        TEXT,
    "stagedStillLabeledUrl" TEXT,
    "restageCount"          INTEGER NOT NULL DEFAULT 0,
    "dgxStagingJobId"       TEXT,
    "dgxRenderJobId"        TEXT,
    "dgxVerticalJobId"      TEXT,
    "videoUrl"              TEXT,
    "finalUrl"              TEXT,
    "videoVerticalUrl"      TEXT,
    "mlsSafeStillUrl"       TEXT,
    "endCardUrl"            TEXT,
    "proofToken"            TEXT,
    "priceCents"            INTEGER NOT NULL DEFAULT 0,
    "costJson"              JSONB,
    "errorCode"             TEXT,
    "errorMessage"          TEXT,
    "createdAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"             TIMESTAMP(3) NOT NULL,
    "completedAt"           TIMESTAMP(3),

    CONSTRAINT "VaterListingJob_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "VaterListingJob_proofToken_key"
    ON "VaterListingJob"("proofToken");

CREATE INDEX IF NOT EXISTS "VaterListingJob_userId_createdAt_idx"
    ON "VaterListingJob"("userId", "createdAt");

CREATE INDEX IF NOT EXISTS "VaterListingJob_status_idx"
    ON "VaterListingJob"("status");
