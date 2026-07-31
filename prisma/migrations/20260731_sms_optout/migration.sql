-- CreateTable
CREATE TABLE IF NOT EXISTS "SmsOptOut" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "optedOut" BOOLEAN NOT NULL DEFAULT true,
    "source" TEXT NOT NULL DEFAULT 'sms_keyword',
    "keyword" TEXT,
    "lastBody" TEXT,
    "optedOutAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "optedInAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SmsOptOut_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "SmsOptOut_phone_key" ON "SmsOptOut"("phone");
CREATE INDEX IF NOT EXISTS "SmsOptOut_optedOut_idx" ON "SmsOptOut"("optedOut");
