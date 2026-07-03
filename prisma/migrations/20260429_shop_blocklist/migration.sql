-- CreateTable
CREATE TABLE "ShopBlocklist" (
    "id" TEXT NOT NULL,
    "pattern" TEXT NOT NULL,
    "matchType" TEXT NOT NULL DEFAULT 'contains',
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShopBlocklist_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ShopBlocklist_matchType_idx" ON "ShopBlocklist"("matchType");
