-- CreateTable
CREATE TABLE "EbayAuth" (
    "id" TEXT NOT NULL,
    "sellerEbayId" TEXT,
    "environment" TEXT NOT NULL DEFAULT 'production',
    "refreshToken" TEXT NOT NULL,
    "refreshTokenExpiresAt" TIMESTAMP(3) NOT NULL,
    "accessToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "scopes" TEXT,
    "paymentPolicyId" TEXT,
    "returnPolicyId" TEXT,
    "fulfillmentPolicyId" TEXT,
    "defaultLocationKey" TEXT,
    "defaultLocationZip" TEXT,
    "lastRefreshError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EbayAuth_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EbayAuth_environment_sellerEbayId_key" ON "EbayAuth"("environment", "sellerEbayId");
