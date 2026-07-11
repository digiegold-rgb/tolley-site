-- Saved delivery-run templates per customer (RegularRun).
-- Powers one-click re-billing of recurring runs (e.g. Wayne Clark / Aramsco):
-- pick a saved run and a DRAFT invoice is generated pre-filled with the
-- drop location + miles * rate.
-- Fully additive — CREATE TABLE IF NOT EXISTS + IF NOT EXISTS index, no existing
-- table or row is touched. Mirrors the 20260704_launchpad_platform pattern so a
-- re-run is a no-op.

CREATE TABLE IF NOT EXISTS "RegularRun" (
  "id"           TEXT NOT NULL,
  "contactId"    TEXT NOT NULL,
  "label"        TEXT NOT NULL,
  "dropLocation" TEXT NOT NULL,
  "miles"        DOUBLE PRECISION NOT NULL,
  "rate"         DOUBLE PRECISION NOT NULL DEFAULT 3,
  "notes"        TEXT,
  "sortOrder"    INTEGER NOT NULL DEFAULT 0,
  "active"       BOOLEAN NOT NULL DEFAULT true,
  "lastUsedAt"   TIMESTAMP(3),
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RegularRun_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "RegularRun_contactId_active_sortOrder_idx"
  ON "RegularRun"("contactId", "active", "sortOrder");

-- FK to AccountContact (cascade delete). Added guarded so re-runs don't error.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'RegularRun_contactId_fkey'
  ) THEN
    ALTER TABLE "RegularRun"
      ADD CONSTRAINT "RegularRun_contactId_fkey"
      FOREIGN KEY ("contactId") REFERENCES "AccountContact"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
