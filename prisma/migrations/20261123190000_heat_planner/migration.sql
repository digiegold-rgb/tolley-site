ALTER TABLE "HeatDay" ADD COLUMN IF NOT EXISTS "planner" JSONB;
CREATE TABLE IF NOT EXISTS "HeatDecision" (
 "id" TEXT PRIMARY KEY, "ts" TIMESTAMP(3) NOT NULL, "kind" TEXT NOT NULL,
 "season" TEXT NOT NULL, "mode" TEXT NOT NULL, "period" TEXT, "reasonCode" TEXT,
 "why" TEXT, "payload" JSONB NOT NULL, "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "HeatDecision_ts_idx" ON "HeatDecision"("ts");
CREATE INDEX IF NOT EXISTS "HeatDecision_kind_ts_idx" ON "HeatDecision"("kind","ts");
CREATE TABLE IF NOT EXISTS "HeatLearned" (
 "id" TEXT PRIMARY KEY, "ts" TIMESTAMP(3) NOT NULL, "season" TEXT NOT NULL,
 "param" TEXT NOT NULL, "key" TEXT NOT NULL, "value" DOUBLE PRECISION NOT NULL,
 "n" INTEGER NOT NULL, "prevValue" DOUBLE PRECISION
);
CREATE INDEX IF NOT EXISTS "HeatLearned_param_key_ts_idx" ON "HeatLearned"("param","key","ts");
CREATE TABLE IF NOT EXISTS "HeatCommand" (
 "id" TEXT PRIMARY KEY, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "action" TEXT NOT NULL, "params" JSONB NOT NULL, "status" TEXT NOT NULL DEFAULT 'queued',
 "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "HeatCommand_status_createdAt_idx" ON "HeatCommand"("status","createdAt");
