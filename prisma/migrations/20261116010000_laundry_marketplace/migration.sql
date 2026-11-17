BEGIN;

-- CreateTable
CREATE TABLE "LaundryOperator" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "legalName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "zip" TEXT NOT NULL,
    "zips" TEXT[],
    "radiusMiles" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT NOT NULL,
    "prices" JSONB NOT NULL,
    "deliveryFeeCents" INTEGER NOT NULL DEFAULT 0,
    "rentalTerms" TEXT NOT NULL,
    "termsVersion" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "anchor" BOOLEAN NOT NULL DEFAULT false,
    "feeCents" INTEGER NOT NULL DEFAULT 4500,
    "stripeCustomerId" TEXT,
    "paymentMethodId" TEXT,
    "paymentSetupAt" TIMESTAMP(3),
    "agreementVersion" TEXT NOT NULL,
    "agreementAcceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),
    "lastAssignedAt" TIMESTAMP(3),
    "websiteRequested" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LaundryOperator_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LaundryLead" (
    "id" TEXT NOT NULL,
    "requestKey" TEXT NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "operatorId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'requested',
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "zip" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "preferredDate" TEXT NOT NULL,
    "deliveryDate" TEXT,
    "notes" TEXT NOT NULL DEFAULT '',
    "smsConsent" BOOLEAN NOT NULL DEFAULT false,
    "attribution" JSONB NOT NULL,
    "agreementText" TEXT,
    "agreementHash" TEXT,
    "signedName" TEXT,
    "signedAt" TIMESTAMP(3),
    "consentVersion" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LaundryLead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LaundryBooking" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "feeCents" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "paymentIntentId" TEXT,
    "refundId" TEXT,
    "refundedCents" INTEGER NOT NULL DEFAULT 0,
    "paidAt" TIMESTAMP(3),
    "refundedAt" TIMESTAMP(3),
    "disputeReason" TEXT,
    "disputeStatus" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LaundryBooking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LaundryReview" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "body" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'published',
    "moderationReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LaundryReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LaundryEvent" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "detail" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LaundryEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LaundryNotification" (
    "id" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "leaseUntil" TIMESTAMP(3),
    "leaseToken" TEXT,
    "providerId" TEXT,
    "lastError" TEXT,
    "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LaundryNotification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LaundryMessage" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "leadId" TEXT,
    "body" TEXT NOT NULL,
    "reply" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LaundryMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LaundryOperator_ownerId_key" ON "LaundryOperator"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "LaundryOperator_slug_key" ON "LaundryOperator"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "LaundryOperator_stripeCustomerId_key" ON "LaundryOperator"("stripeCustomerId");

-- CreateIndex
CREATE INDEX "LaundryOperator_status_idx" ON "LaundryOperator"("status");

-- CreateIndex
CREATE UNIQUE INDEX "LaundryLead_requestKey_key" ON "LaundryLead"("requestKey");

-- CreateIndex
CREATE INDEX "LaundryLead_operatorId_status_createdAt_idx" ON "LaundryLead"("operatorId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "LaundryLead_zip_createdAt_idx" ON "LaundryLead"("zip", "createdAt");

-- CreateIndex
CREATE INDEX "LaundryLead_status_expiresAt_idx" ON "LaundryLead"("status", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "LaundryBooking_leadId_key" ON "LaundryBooking"("leadId");

-- CreateIndex
CREATE UNIQUE INDEX "LaundryBooking_paymentIntentId_key" ON "LaundryBooking"("paymentIntentId");

-- CreateIndex
CREATE UNIQUE INDEX "LaundryBooking_refundId_key" ON "LaundryBooking"("refundId");

-- CreateIndex
CREATE UNIQUE INDEX "LaundryReview_leadId_key" ON "LaundryReview"("leadId");

-- CreateIndex
CREATE INDEX "LaundryEvent_leadId_createdAt_idx" ON "LaundryEvent"("leadId", "createdAt");

-- CreateIndex
CREATE INDEX "LaundryNotification_status_availableAt_idx" ON "LaundryNotification"("status", "availableAt");

-- CreateIndex
CREATE INDEX "LaundryMessage_leadId_createdAt_idx" ON "LaundryMessage"("leadId", "createdAt");

-- AddForeignKey
ALTER TABLE "LaundryLead" ADD CONSTRAINT "LaundryLead_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "LaundryOperator"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LaundryBooking" ADD CONSTRAINT "LaundryBooking_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "LaundryLead"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LaundryReview" ADD CONSTRAINT "LaundryReview_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "LaundryLead"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LaundryEvent" ADD CONSTRAINT "LaundryEvent_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "LaundryLead"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


COMMIT;
