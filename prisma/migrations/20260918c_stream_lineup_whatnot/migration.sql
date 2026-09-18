-- tolley.io/stream lineups — Whatnot CSV export fields (2026-09-18). ADDITIVE + IDEMPOTENT, applied by hand before deploy.
ALTER TABLE "StreamLineup"     ADD COLUMN IF NOT EXISTS "whatnot" JSONB;
ALTER TABLE "StreamLineupItem" ADD COLUMN IF NOT EXISTS "whatnot" JSONB;
