-- WorkerHeartbeat — 2026-08-17.
-- Background drainers (bulk-ingest-worker, fb-draft-worker) stamp a row every
-- poll tick. The site reads it so /shop/admin/bulk-add can say "worker offline"
-- instead of "Working…" forever (28h silent outage 8/16-17 after an OOM storm).
-- ADDITIVE + IDEMPOTENT.
-- Apply:
--   cd ~/tolley-site && npx prisma db execute \
--     --file prisma/migrations/20260817_worker_heartbeat/migration.sql \
--     --schema prisma/schema.prisma
CREATE TABLE IF NOT EXISTS "WorkerHeartbeat" (
  "name"      TEXT PRIMARY KEY,
  "lastSeen"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "hostname"  TEXT,
  "pid"       INTEGER,
  "meta"      JSONB
);
