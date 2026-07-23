-- CreateTable
CREATE TABLE "MustCompleteItem" (
    "id" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'red',
    "category" TEXT NOT NULL DEFAULT 'general',
    "title" TEXT NOT NULL,
    "detail" TEXT,
    "links" JSONB NOT NULL DEFAULT '[]',
    "command" TEXT,
    "afterNote" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "source" TEXT NOT NULL DEFAULT 'claude',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MustCompleteItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MustCompleteItem_status_sortOrder_idx" ON "MustCompleteItem"("status", "sortOrder");
