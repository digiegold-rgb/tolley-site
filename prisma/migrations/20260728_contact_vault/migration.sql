-- CreateTable
CREATE TABLE "ContactVaultEntry" (
    "id" TEXT NOT NULL,
    "phoneE164" TEXT NOT NULL,
    "displayName" TEXT,
    "emails" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "org" TEXT,
    "sources" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isPerson" BOOLEAN NOT NULL DEFAULT true,
    "areaCode" TEXT,
    "isKcMetro" BOOLEAN NOT NULL DEFAULT false,
    "linkedType" TEXT,
    "linkedId" TEXT,
    "relationship" TEXT NOT NULL DEFAULT 'unknown',
    "suppressed" BOOLEAN NOT NULL DEFAULT false,
    "suppressedAt" TIMESTAMP(3),
    "suppressReason" TEXT,
    "invites" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContactVaultEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ContactVaultEntry_phoneE164_key" ON "ContactVaultEntry"("phoneE164");

-- CreateIndex
CREATE INDEX "ContactVaultEntry_suppressed_isPerson_idx" ON "ContactVaultEntry"("suppressed", "isPerson");

-- CreateIndex
CREATE INDEX "ContactVaultEntry_isKcMetro_idx" ON "ContactVaultEntry"("isKcMetro");

-- CreateIndex
CREATE INDEX "ContactVaultEntry_linkedType_idx" ON "ContactVaultEntry"("linkedType");
