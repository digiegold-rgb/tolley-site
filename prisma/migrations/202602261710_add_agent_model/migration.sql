-- CreateTable
CREATE TABLE "public"."Agent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rolePurpose" TEXT NOT NULL,
    "modelProvider" TEXT NOT NULL,
    "systemPrompt" TEXT NOT NULL,
    "toolsEnabled" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "webhookUrl" TEXT,
    "phoneBinding" TEXT,
    "emailBinding" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Agent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Agent_userId_updatedAt_idx" ON "public"."Agent"("userId", "updatedAt");

-- AddForeignKey
ALTER TABLE "public"."Agent" ADD CONSTRAINT "Agent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
