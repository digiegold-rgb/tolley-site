-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "ownerSubscriberId" TEXT;

-- CreateTable
CREATE TABLE "CustomerLeadState" (
    "id" TEXT NOT NULL,
    "subscriberId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'new',
    "notes" TEXT,
    "referredTo" TEXT,
    "referralStatus" TEXT,
    "referralFee" DOUBLE PRECISION,
    "contactedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "ownerName" TEXT,
    "ownerPhone" TEXT,
    "ownerEmail" TEXT,
    "pipelineStage" TEXT NOT NULL DEFAULT 'new_lead',
    "pipelineOrder" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerLeadState_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CustomerLeadState_subscriberId_status_idx" ON "CustomerLeadState"("subscriberId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerLeadState_subscriberId_leadId_key" ON "CustomerLeadState"("subscriberId", "leadId");

-- AddForeignKey
ALTER TABLE "CustomerLeadState" ADD CONSTRAINT "CustomerLeadState_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
