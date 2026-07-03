-- CreateTable
CREATE TABLE "WhatsappWatch" (
    "id" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "chatName" TEXT,
    "groupMode" TEXT NOT NULL DEFAULT 'single',
    "count" INTEGER NOT NULL DEFAULT 50,
    "lastSeenTs" INTEGER NOT NULL DEFAULT 0,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "lastRunAt" TIMESTAMP(3),
    "lastError" TEXT,
    "lastListed" INTEGER NOT NULL DEFAULT 0,
    "totalListed" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WhatsappWatch_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "WhatsappWatch_chatId_key" ON "WhatsappWatch"("chatId");
CREATE INDEX "WhatsappWatch_enabled_idx" ON "WhatsappWatch"("enabled");
