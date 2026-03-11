-- Client Intelligence: Deep Client Profiling

-- Add employment, income, DISC, and readiness fields to Client
ALTER TABLE "Client" ADD COLUMN "jobTitle" TEXT;
ALTER TABLE "Client" ADD COLUMN "employer" TEXT;
ALTER TABLE "Client" ADD COLUMN "industry" TEXT;
ALTER TABLE "Client" ADD COLUMN "educationLevel" TEXT;
ALTER TABLE "Client" ADD COLUMN "estimatedIncome" DOUBLE PRECISION;
ALTER TABLE "Client" ADD COLUMN "incomeRangeLow" DOUBLE PRECISION;
ALTER TABLE "Client" ADD COLUMN "incomeRangeHigh" DOUBLE PRECISION;
ALTER TABLE "Client" ADD COLUMN "incomeSource" TEXT;
ALTER TABLE "Client" ADD COLUMN "incomeConfidence" TEXT;
ALTER TABLE "Client" ADD COLUMN "incomeEstimatedAt" TIMESTAMP(3);
ALTER TABLE "Client" ADD COLUMN "estimatedMaxHome" DOUBLE PRECISION;
ALTER TABLE "Client" ADD COLUMN "affordabilityData" JSONB;
ALTER TABLE "Client" ADD COLUMN "discType" TEXT;
ALTER TABLE "Client" ADD COLUMN "discSecondary" TEXT;
ALTER TABLE "Client" ADD COLUMN "discAssessment" JSONB;
ALTER TABLE "Client" ADD COLUMN "readinessScore" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Client" ADD COLUMN "readinessFactors" JSONB;

-- Create index on readinessScore
CREATE INDEX "Client_readinessScore_idx" ON "Client"("readinessScore");

-- TriggerEvent table
CREATE TABLE "TriggerEvent" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "strength" TEXT,
    "details" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TriggerEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TriggerEvent_clientId_occurredAt_idx" ON "TriggerEvent"("clientId", "occurredAt");
CREATE INDEX "TriggerEvent_type_idx" ON "TriggerEvent"("type");

ALTER TABLE "TriggerEvent" ADD CONSTRAINT "TriggerEvent_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ClientMatch table
CREATE TABLE "ClientMatch" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "matchScore" INTEGER NOT NULL DEFAULT 0,
    "matchFactors" JSONB,
    "direction" TEXT NOT NULL DEFAULT 'client_to_listing',
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientMatch_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ClientMatch_clientId_listingId_direction_key" ON "ClientMatch"("clientId", "listingId", "direction");
CREATE INDEX "ClientMatch_matchScore_idx" ON "ClientMatch"("matchScore");

ALTER TABLE "ClientMatch" ADD CONSTRAINT "ClientMatch_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
