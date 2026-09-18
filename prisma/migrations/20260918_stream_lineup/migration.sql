-- tolley.io/stream — product lineups for live sales (2026-09-18).
--
-- ADDITIVE + IDEMPOTENT. Two new tables, nothing dropped, nothing rewritten;
-- safe against a live database, safe to run twice.
--
-- Apply by hand BEFORE the code that reads them deploys:
--   npx tsx scripts/apply-stream-lineup-2026-09-18.ts --apply

CREATE TABLE IF NOT EXISTS "StreamLineup" (
  "id"           TEXT NOT NULL,
  "slug"         TEXT NOT NULL,
  "name"         TEXT NOT NULL,
  "currentIndex" INTEGER NOT NULL DEFAULT 0,
  "active"       BOOLEAN NOT NULL DEFAULT false,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StreamLineup_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "StreamLineup_slug_key" ON "StreamLineup"("slug");

CREATE TABLE IF NOT EXISTS "StreamLineupItem" (
  "id"               TEXT NOT NULL,
  "lineupId"         TEXT NOT NULL,
  "productId"        TEXT NOT NULL,
  "sortOrder"        INTEGER NOT NULL,
  "amazonUrl"        TEXT,
  "amazonVerified"   BOOLEAN NOT NULL DEFAULT false,
  "amazonPriceCents" INTEGER,
  "salePrice"        DOUBLE PRECISION,
  "weightOz"         INTEGER,
  "lengthIn"         DOUBLE PRECISION,
  "widthIn"          DOUBLE PRECISION,
  "heightIn"         DOUBLE PRECISION,
  "tiktokListed"     BOOLEAN NOT NULL DEFAULT false,
  "soldAt"           TIMESTAMP(3),
  "notes"            TEXT,
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StreamLineupItem_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "StreamLineupItem_lineupId_fkey" FOREIGN KEY ("lineupId") REFERENCES "StreamLineup"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "StreamLineupItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "StreamLineupItem_lineupId_productId_key" ON "StreamLineupItem"("lineupId", "productId");
CREATE INDEX IF NOT EXISTS "StreamLineupItem_lineupId_sortOrder_idx" ON "StreamLineupItem"("lineupId", "sortOrder");
CREATE INDEX IF NOT EXISTS "StreamLineupItem_productId_idx" ON "StreamLineupItem"("productId");
