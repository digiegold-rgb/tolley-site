-- Vater Direct (2026-08-09): Trey's studio dictation lane. Jobs are claimed
-- by the DGX vater-direct-runner; messages carry the question round-trip.
CREATE TABLE IF NOT EXISTS "VaterDirectJob" (
    "id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "claudeSessionId" VARCHAR(64),
    "createdByEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VaterDirectJob_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "VaterDirectMessage" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'text',
    "text" TEXT NOT NULL,
    "deliveredToRunner" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VaterDirectMessage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "VaterDirectJob_status_createdAt_idx"
    ON "VaterDirectJob"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "VaterDirectMessage_jobId_createdAt_idx"
    ON "VaterDirectMessage"("jobId", "createdAt");

DO $$ BEGIN
    ALTER TABLE "VaterDirectMessage"
        ADD CONSTRAINT "VaterDirectMessage_jobId_fkey"
        FOREIGN KEY ("jobId") REFERENCES "VaterDirectJob"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
