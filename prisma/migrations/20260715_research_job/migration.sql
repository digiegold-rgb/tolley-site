-- Deep Research Search (/research) — ResearchJob table.
-- One row per research question. Lane 1 answers instantly from completed
-- rows (queryNormalized exact match, later Qdrant semantic match); Lane 2
-- submits to OpenManus on the DGX and live-polls progress.
-- Fully additive — CREATE TABLE IF NOT EXISTS + IF NOT EXISTS indexes, no
-- existing table or row is touched, so a re-run is a no-op.

CREATE TABLE IF NOT EXISTS "ResearchJob" (
  "id"              TEXT NOT NULL,
  "query"           TEXT NOT NULL,
  "queryNormalized" TEXT NOT NULL,
  "status"          TEXT NOT NULL DEFAULT 'queued',
  "progress"        INTEGER NOT NULL DEFAULT 0,
  "currentPhase"    TEXT,
  "currentStep"     TEXT,
  "stepDetails"     JSONB,
  "manusTaskId"     TEXT,
  "verifyTaskId"    TEXT,
  "etaSeconds"      INTEGER,
  "confidence"      INTEGER,
  "result"          JSONB,
  "errorMessage"    TEXT,
  "cacheHits"       INTEGER NOT NULL DEFAULT 0,
  "qdrantPointId"   TEXT,
  "requestedBy"     TEXT,
  "startedAt"       TIMESTAMP(3),
  "completedAt"     TIMESTAMP(3),
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ResearchJob_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ResearchJob_status_createdAt_idx" ON "ResearchJob"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "ResearchJob_queryNormalized_status_idx" ON "ResearchJob"("queryNormalized", "status");
