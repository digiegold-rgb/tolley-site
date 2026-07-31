-- CreateTable
CREATE TABLE "VideoCost" (
    "id" TEXT NOT NULL,
    "videoKey" TEXT NOT NULL,
    "pipeline" TEXT NOT NULL,
    "title" TEXT,
    "template" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "url" TEXT,
    "clipsCents" INTEGER NOT NULL DEFAULT 0,
    "lipsyncCents" INTEGER NOT NULL DEFAULT 0,
    "scriptCents" INTEGER NOT NULL DEFAULT 0,
    "ttsCents" INTEGER NOT NULL DEFAULT 0,
    "postCents" INTEGER NOT NULL DEFAULT 0,
    "estimated" BOOLEAN NOT NULL DEFAULT false,
    "renderedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VideoCost_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VideoCost_videoKey_key" ON "VideoCost"("videoKey");
CREATE INDEX "VideoCost_renderedAt_idx" ON "VideoCost"("renderedAt");
CREATE INDEX "VideoCost_pipeline_renderedAt_idx" ON "VideoCost"("pipeline", "renderedAt");
