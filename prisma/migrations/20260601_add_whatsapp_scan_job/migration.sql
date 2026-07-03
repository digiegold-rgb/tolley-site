-- CreateTable
CREATE TABLE "WhatsappScanJob" (
    "id" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "chatName" TEXT,
    "count" INTEGER NOT NULL DEFAULT 50,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "batchId" TEXT,
    "photosFound" INTEGER NOT NULL DEFAULT 0,
    "groups" INTEGER NOT NULL DEFAULT 0,
    "skipped" INTEGER NOT NULL DEFAULT 0,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastStage" TEXT,
    "lastError" TEXT,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsappScanJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WhatsappScanJob_status_nextAttemptAt_idx" ON "WhatsappScanJob"("status", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "WhatsappScanJob_batchId_idx" ON "WhatsappScanJob"("batchId");
