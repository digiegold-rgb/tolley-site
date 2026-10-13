-- AlterTable
ALTER TABLE "SiteView" ADD COLUMN     "eventKey" TEXT,
ADD COLUMN     "visitorId" TEXT;

-- AlterTable
ALTER TABLE "SiteEvent" ADD COLUMN     "audience" TEXT NOT NULL DEFAULT 'unknown',
ADD COLUMN     "visitorId" TEXT;

-- CreateTable
CREATE TABLE "HqCustomer" (
    "closedAt" TIMESTAMP(3),
    "id" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "name" TEXT,
    "notes" TEXT,
    "reportedSource" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HqCustomer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HqCustomerLink" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "confidence" TEXT NOT NULL,
    "evidence" TEXT NOT NULL,
    "snapshot" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HqCustomerLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HqCustomerEvent" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "sourceKey" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "body" TEXT,
    "meta" JSONB,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HqCustomerEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HqCustomerAttachment" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "sourceKey" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "encrypted" BYTEA NOT NULL,
    "encryptedPreview" BYTEA,
    "size" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HqCustomerAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HqPhoneThread" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "name" TEXT,
    "customerId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'candidate',
    "lastMessageAt" TIMESTAMP(3) NOT NULL,
    "lastSyncedAt" TIMESTAMP(3),
    "checkpoint" TEXT,

    CONSTRAINT "HqPhoneThread_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HqSyncState" (
    "id" TEXT NOT NULL,
    "lastAttemptAt" TIMESTAMP(3),
    "lastSuccessAt" TIMESTAMP(3),
    "error" TEXT,
    "meta" JSONB,

    CONSTRAINT "HqSyncState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContactReference" (
    "code" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "visitorId" TEXT,
    "offering" TEXT NOT NULL,
    "attribution" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContactReference_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "VisitorSession" (
    "id" TEXT NOT NULL,
    "visitorId" TEXT,
    "firstTouch" JSONB,
    "latestTouch" JSONB,
    "landingPath" TEXT NOT NULL,
    "userAgent" TEXT,
    "audience" TEXT NOT NULL DEFAULT 'anonymous',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VisitorSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SiteDailyTotal" (
    "day" TEXT NOT NULL,
    "site" TEXT NOT NULL,
    "views" INTEGER NOT NULL,
    "events" INTEGER NOT NULL,
    "sessions" INTEGER NOT NULL,

    CONSTRAINT "SiteDailyTotal_pkey" PRIMARY KEY ("day","site")
);

-- CreateIndex
CREATE UNIQUE INDEX "HqCustomer_phone_key" ON "HqCustomer"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "HqCustomer_email_key" ON "HqCustomer"("email");

-- CreateIndex
CREATE INDEX "HqCustomerLink_customerId_idx" ON "HqCustomerLink"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "HqCustomerLink_kind_sourceId_key" ON "HqCustomerLink"("kind", "sourceId");

-- CreateIndex
CREATE UNIQUE INDEX "HqCustomerEvent_sourceKey_key" ON "HqCustomerEvent"("sourceKey");

-- CreateIndex
CREATE INDEX "HqCustomerEvent_customerId_occurredAt_idx" ON "HqCustomerEvent"("customerId", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "HqCustomerAttachment_sourceKey_key" ON "HqCustomerAttachment"("sourceKey");

-- CreateIndex
CREATE INDEX "HqPhoneThread_status_lastMessageAt_idx" ON "HqPhoneThread"("status", "lastMessageAt");

-- CreateIndex
CREATE UNIQUE INDEX "ContactReference_sessionId_offering_key" ON "ContactReference"("sessionId", "offering");

-- CreateIndex
CREATE INDEX "VisitorSession_visitorId_createdAt_idx" ON "VisitorSession"("visitorId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SiteView_eventKey_key" ON "SiteView"("eventKey");

-- CreateIndex
CREATE INDEX "SiteView_sessionId_createdAt_idx" ON "SiteView"("sessionId", "createdAt");

-- CreateIndex
CREATE INDEX "SiteView_visitorId_createdAt_idx" ON "SiteView"("visitorId", "createdAt");

-- CreateIndex
CREATE INDEX "SiteEvent_sessionId_createdAt_idx" ON "SiteEvent"("sessionId", "createdAt");

-- CreateIndex
CREATE INDEX "SiteEvent_visitorId_createdAt_idx" ON "SiteEvent"("visitorId", "createdAt");

-- AddForeignKey
ALTER TABLE "HqCustomerLink" ADD CONSTRAINT "HqCustomerLink_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "HqCustomer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HqCustomerEvent" ADD CONSTRAINT "HqCustomerEvent_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "HqCustomer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HqCustomerAttachment" ADD CONSTRAINT "HqCustomerAttachment_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "HqCustomerEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HqPhoneThread" ADD CONSTRAINT "HqPhoneThread_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "HqCustomer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

