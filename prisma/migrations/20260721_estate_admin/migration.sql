-- Estate admin (/hq Estates tab) — EstateLead seller pipeline + EstateSale
-- checklist column. Fully additive — IF NOT EXISTS everywhere, no existing
-- table or row is touched, so a re-run is a no-op.

ALTER TABLE "EstateSale" ADD COLUMN IF NOT EXISTS "checklist" JSONB;

CREATE TABLE IF NOT EXISTS "EstateLead" (
  "id"            TEXT NOT NULL,
  "name"          TEXT NOT NULL,
  "phone"         TEXT,
  "email"         TEXT,
  "address"       TEXT,
  "city"          TEXT NOT NULL DEFAULT 'Independence',
  "source"        TEXT NOT NULL DEFAULT 'manual',
  "stage"         TEXT NOT NULL DEFAULT 'inquiry',
  "notes"         TEXT,
  "walkthroughAt" TIMESTAMP(3),
  "saleId"        TEXT,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL,

  CONSTRAINT "EstateLead_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "EstateLead_saleId_fkey" FOREIGN KEY ("saleId")
    REFERENCES "EstateSale"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "EstateLead_stage_idx" ON "EstateLead"("stage");
CREATE INDEX IF NOT EXISTS "EstateLead_createdAt_idx" ON "EstateLead"("createdAt");
