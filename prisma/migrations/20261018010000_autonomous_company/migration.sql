-- CreateTable
CREATE TABLE "CompanyKeyGrant" (
    "keyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "scopes" TEXT[],
    "monthlyLimitCents" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompanyKeyGrant_pkey" PRIMARY KEY ("keyId")
);

-- CreateTable
CREATE TABLE "CompanyQuote" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "keyId" TEXT NOT NULL,
    "capabilityId" TEXT NOT NULL,
    "capabilityVersion" TEXT NOT NULL,
    "input" JSONB NOT NULL,
    "inputHash" TEXT NOT NULL,
    "providerCents" INTEGER NOT NULL,
    "serviceCents" INTEGER NOT NULL,
    "maxCents" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompanyQuote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyTask" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "keyId" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "capabilityId" TEXT NOT NULL,
    "capabilityVersion" TEXT NOT NULL,
    "adapter" TEXT NOT NULL,
    "input" JSONB NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'queued',
    "result" JSONB,
    "error" TEXT,
    "projectId" TEXT,
    "maxCents" INTEGER NOT NULL,
    "chargedCents" INTEGER NOT NULL DEFAULT 0,
    "providerCents" INTEGER NOT NULL DEFAULT 0,
    "serviceCents" INTEGER NOT NULL DEFAULT 0,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leaseUntil" TIMESTAMP(3),
    "leaseToken" TEXT,
    "cancelRequested" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "CompanyTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyReservation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "cents" INTEGER NOT NULL,
    "purchasedOnly" BOOLEAN NOT NULL DEFAULT true,
    "projectId" TEXT,
    "taskId" TEXT,
    "state" TEXT NOT NULL DEFAULT 'held',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyReservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyKnowledge" (
    "id" TEXT NOT NULL,
    "audience" TEXT NOT NULL DEFAULT 'internal',
    "userId" TEXT,
    "sourceKey" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "sources" JSONB NOT NULL,
    "contentHash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'candidate',
    "evidence" JSONB,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyKnowledge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyExperiment" (
    "id" TEXT NOT NULL,
    "demandKey" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "specification" JSONB NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'queued',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "month" TEXT NOT NULL,
    "reservedCents" INTEGER NOT NULL DEFAULT 0,
    "spentCents" INTEGER NOT NULL DEFAULT 0,
    "leaseUntil" TIMESTAMP(3),
    "evidence" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyExperiment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyCapability" (
    "id" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'candidate',
    "manifest" JSONB NOT NULL,
    "recipe" JSONB NOT NULL,
    "evidence" JSONB NOT NULL,
    "previousVersion" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyCapability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyEvent" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "userId" TEXT,
    "taskId" TEXT,
    "kind" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompanyEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyOutbox" (
    "id" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "userId" TEXT,
    "taskId" TEXT,
    "keyId" TEXT,
    "payload" JSONB NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leaseUntil" TIMESTAMP(3),
    "leaseToken" TEXT,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompanyOutbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyControl" (
    "id" TEXT NOT NULL DEFAULT 'company',
    "admission" BOOLEAN NOT NULL DEFAULT false,
    "learning" BOOLEAN NOT NULL DEFAULT false,
    "development" BOOLEAN NOT NULL DEFAULT false,
    "deployment" BOOLEAN NOT NULL DEFAULT false,
    "workerHeartbeat" TIMESTAMP(3),
    "lastDiscovery" TIMESTAMP(3),
    "lastDigest" TIMESTAMP(3),
    "policyVersion" TEXT NOT NULL DEFAULT '2026-10-17.1',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyControl_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyDecision" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "request" JSONB NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'pending',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompanyDecision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CompanyKeyGrant_userId_idx" ON "CompanyKeyGrant"("userId");

-- CreateIndex
CREATE INDEX "CompanyQuote_userId_createdAt_idx" ON "CompanyQuote"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyTask_quoteId_key" ON "CompanyTask"("quoteId");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyTask_projectId_key" ON "CompanyTask"("projectId");

-- CreateIndex
CREATE INDEX "CompanyTask_state_availableAt_leaseUntil_idx" ON "CompanyTask"("state", "availableAt", "leaseUntil");

-- CreateIndex
CREATE INDEX "CompanyTask_userId_createdAt_idx" ON "CompanyTask"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "CompanyTask_keyId_createdAt_idx" ON "CompanyTask"("keyId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyTask_userId_idempotencyKey_key" ON "CompanyTask"("userId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyReservation_projectId_key" ON "CompanyReservation"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyReservation_taskId_key" ON "CompanyReservation"("taskId");

-- CreateIndex
CREATE INDEX "CompanyReservation_userId_state_idx" ON "CompanyReservation"("userId", "state");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyKnowledge_sourceKey_key" ON "CompanyKnowledge"("sourceKey");

-- CreateIndex
CREATE INDEX "CompanyKnowledge_userId_status_idx" ON "CompanyKnowledge"("userId", "status");

-- CreateIndex
CREATE INDEX "CompanyKnowledge_audience_status_expiresAt_idx" ON "CompanyKnowledge"("audience", "status", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyExperiment_demandKey_key" ON "CompanyExperiment"("demandKey");

-- CreateIndex
CREATE INDEX "CompanyExperiment_state_leaseUntil_idx" ON "CompanyExperiment"("state", "leaseUntil");

-- CreateIndex
CREATE INDEX "CompanyExperiment_month_idx" ON "CompanyExperiment"("month");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyEvent_key_key" ON "CompanyEvent"("key");

-- CreateIndex
CREATE INDEX "CompanyEvent_taskId_createdAt_idx" ON "CompanyEvent"("taskId", "createdAt");

-- CreateIndex
CREATE INDEX "CompanyEvent_kind_createdAt_idx" ON "CompanyEvent"("kind", "createdAt");

-- CreateIndex
CREATE INDEX "CompanyOutbox_state_availableAt_idx" ON "CompanyOutbox"("state", "availableAt");


-- Financial invariants are enforced independently of model-generated input.
ALTER TABLE "CompanyQuote" ADD CONSTRAINT "CompanyQuote_amounts" CHECK ("providerCents" >= 0 AND "serviceCents" >= 0 AND "maxCents" = "providerCents" + "serviceCents");
ALTER TABLE "CompanyTask" ADD CONSTRAINT "CompanyTask_amounts" CHECK ("chargedCents" >= 0 AND "chargedCents" <= "maxCents" AND "maxCents" >= 0);
ALTER TABLE "CompanyReservation" ADD CONSTRAINT "CompanyReservation_amounts" CHECK ("cents" >= 0);
ALTER TABLE "CompanyExperiment" ADD CONSTRAINT "CompanyExperiment_amounts" CHECK ("spentCents" >= 0 AND "reservedCents" >= 0 AND "reservedCents" <= 1000);
ALTER TABLE "CompanyKeyGrant" ADD CONSTRAINT "CompanyKeyGrant_amounts" CHECK ("monthlyLimitCents" >= 0);
CREATE INDEX "CompanyKnowledge_fulltext" ON "CompanyKnowledge" USING GIN (to_tsvector('english', "title" || ' ' || "body"));
