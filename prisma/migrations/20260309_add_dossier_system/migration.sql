-- Phase 4: Deep Lead Intelligence (Dossier System)

-- DossierJob: tracks research requests
CREATE TABLE "DossierJob" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "leadId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "currentStep" TEXT,
    "stepsCompleted" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "stepsFailed" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "errorMessage" TEXT,
    "requestedBy" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DossierJob_pkey" PRIMARY KEY ("id")
);

-- DossierResult: research findings
CREATE TABLE "DossierResult" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "owners" JSONB,
    "entityType" TEXT,
    "entityName" TEXT,
    "courtCases" JSONB,
    "liens" JSONB,
    "bankruptcies" JSONB,
    "taxRecords" JSONB,
    "deedHistory" JSONB,
    "socialProfiles" JSONB,
    "webMentions" JSONB,
    "relatedPeople" JSONB,
    "streetViewUrl" TEXT,
    "satelliteUrl" TEXT,
    "neighborhoodPhotos" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "motivationScore" INTEGER,
    "motivationFlags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "researchSummary" TEXT,
    "pluginData" JSONB,
    "neighborhoodData" JSONB,
    "financialData" JSONB,
    "permitData" JSONB,
    "rentalData" JSONB,
    "businessData" JSONB,
    "environmentalData" JSONB,
    "marketData" JSONB,
    "customData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DossierResult_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX "DossierJob_status_priority_idx" ON "DossierJob"("status", "priority");
CREATE INDEX "DossierJob_listingId_idx" ON "DossierJob"("listingId");
CREATE INDEX "DossierJob_createdAt_idx" ON "DossierJob"("createdAt");
CREATE UNIQUE INDEX "DossierResult_jobId_key" ON "DossierResult"("jobId");
CREATE INDEX "DossierResult_motivationScore_idx" ON "DossierResult"("motivationScore");

-- Foreign keys
ALTER TABLE "DossierJob" ADD CONSTRAINT "DossierJob_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DossierResult" ADD CONSTRAINT "DossierResult_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "DossierJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
