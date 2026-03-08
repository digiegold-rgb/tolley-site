-- CreateTable
CREATE TABLE "public"."SavedResult" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "contentJson" JSONB NOT NULL,
    "contentText" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SavedResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SavedResult_userId_updatedAt_idx" ON "public"."SavedResult"("userId", "updatedAt");

-- AddForeignKey
ALTER TABLE "public"."SavedResult" ADD CONSTRAINT "SavedResult_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
