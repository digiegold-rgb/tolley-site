CREATE TABLE "ContentIncomeAccount" (
 "id" TEXT PRIMARY KEY, "platform" TEXT NOT NULL DEFAULT 'facebook', "externalId" TEXT NOT NULL UNIQUE, "label" TEXT NOT NULL,
 "paused" BOOLEAN NOT NULL DEFAULT true, "startedAt" TIMESTAMP(3), "programStatus" TEXT NOT NULL DEFAULT 'unknown', "payoutsVerified" BOOLEAN NOT NULL DEFAULT false,
 "programEvidence" TEXT, "programVerifiedAt" TIMESTAMP(3), "connectionCheckedAt" TIMESTAMP(3), "followers" INTEGER, "metricsError" TEXT, "heartbeatAt" TIMESTAMP(3),
 "earningsCheckedAt" TIMESTAMP(3), "earningsError" TEXT, "qualifiedViewsError" TEXT,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE TABLE "ContentIncomePost" (
 "id" TEXT PRIMARY KEY, "accountId" TEXT NOT NULL REFERENCES "ContentIncomeAccount"("id") ON UPDATE CASCADE, "scheduleKey" TEXT NOT NULL, "topicKey" TEXT NOT NULL,
 "format" TEXT NOT NULL, "headline" TEXT NOT NULL, "caption" TEXT NOT NULL, "points" JSONB NOT NULL, "status" TEXT NOT NULL DEFAULT 'queued',
 "scheduledAt" TIMESTAMP(3) NOT NULL, "attemptedAt" TIMESTAMP(3), "publishedAt" TIMESTAMP(3), "externalId" TEXT UNIQUE, "url" TEXT, "error" TEXT,
 "views" INTEGER, "qualifiedViews" INTEGER, "reactions" INTEGER, "comments" INTEGER, "shares" INTEGER, "follows" INTEGER, "earningsCents" INTEGER,
 "metricsSource" TEXT, "metricsAt" TIMESTAMP(3), "ownerMetricsAt" TIMESTAMP(3), "ownerMetricsEvidence" TEXT, "metricsError" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
 UNIQUE("accountId", "scheduleKey")
);
CREATE INDEX "ContentIncomePost_status_scheduledAt_idx" ON "ContentIncomePost"("status", "scheduledAt");
CREATE INDEX "ContentIncomePost_accountId_publishedAt_idx" ON "ContentIncomePost"("accountId", "publishedAt");
CREATE TABLE "ContentIncomeReceipt" (
 "id" TEXT PRIMARY KEY, "accountId" TEXT NOT NULL REFERENCES "ContentIncomeAccount"("id") ON UPDATE CASCADE, "externalId" TEXT NOT NULL, "amountCents" INTEGER NOT NULL,
 "status" TEXT NOT NULL, "period" TEXT NOT NULL, "evidence" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
 UNIQUE("accountId", "externalId")
);
CREATE TABLE "ContentIncomeEarningDay" (
 "id" TEXT PRIMARY KEY, "accountId" TEXT NOT NULL REFERENCES "ContentIncomeAccount"("id") ON UPDATE CASCADE, "endTime" TIMESTAMP(3) NOT NULL,
 "amountMicros" BIGINT NOT NULL, "currency" TEXT NOT NULL, "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE("accountId", "endTime")
);
