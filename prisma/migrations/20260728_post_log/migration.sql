-- CreateTable
CREATE TABLE "PostLogEntry" (
    "id" TEXT NOT NULL,
    "job" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "account" TEXT,
    "business" TEXT,
    "status" TEXT NOT NULL,
    "title" TEXT,
    "url" TEXT,
    "error" TEXT,
    "costCents" INTEGER NOT NULL DEFAULT 0,
    "firedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PostLogEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PostLogEntry_firedAt_idx" ON "PostLogEntry"("firedAt");
CREATE INDEX "PostLogEntry_job_firedAt_idx" ON "PostLogEntry"("job", "firedAt");
CREATE INDEX "PostLogEntry_channel_firedAt_idx" ON "PostLogEntry"("channel", "firedAt");
CREATE INDEX "PostLogEntry_runId_idx" ON "PostLogEntry"("runId");
