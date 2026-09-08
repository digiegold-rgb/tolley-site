ALTER TABLE "LeadAction" ADD COLUMN "requestKey" TEXT;
CREATE UNIQUE INDEX "LeadAction_requestKey_key" ON "LeadAction"("requestKey");
ALTER TABLE "WdPayment" ADD COLUMN "paidAtSource" TEXT, ADD COLUMN "failureAttempts" INTEGER NOT NULL DEFAULT 0;
CREATE TABLE "LeadNotification" (
 "id" TEXT PRIMARY KEY, "kind" TEXT NOT NULL, "leadId" TEXT NOT NULL,
 "channel" TEXT NOT NULL, "payload" JSONB NOT NULL, "status" TEXT NOT NULL DEFAULT 'pending',
 "attempts" INTEGER NOT NULL DEFAULT 0, "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "lockedAt" TIMESTAMP(3), "sentAt" TIMESTAMP(3), "lastError" TEXT,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "LeadNotification_status_availableAt_idx" ON "LeadNotification"("status", "availableAt");
ALTER TABLE "WdClient" ADD COLUMN "monthlyAmount" DOUBLE PRECISION, ADD COLUMN "stripeSyncedAt" TIMESTAMP(3);
ALTER TABLE "SiteView" ADD COLUMN "audience" TEXT NOT NULL DEFAULT 'unknown', ADD COLUMN "sessionId" TEXT, ADD COLUMN "campaign" JSONB;
ALTER TABLE "SiteEvent" ADD COLUMN "sessionId" TEXT, ADD COLUMN "eventKey" TEXT;
CREATE UNIQUE INDEX "SiteEvent_eventKey_key" ON "SiteEvent"("eventKey");
