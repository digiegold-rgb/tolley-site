-- AlterTable
ALTER TABLE "StreamLineupItem" ADD COLUMN     "soldQuantity" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "InventoryStock" (
    "blocked" BOOLEAN NOT NULL DEFAULT false,
    "productId" TEXT NOT NULL,
    "onHand" INTEGER NOT NULL DEFAULT 1,
    "reserved" INTEGER NOT NULL DEFAULT 0,
    "available" INTEGER NOT NULL DEFAULT 1,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "countedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryStock_pkey" PRIMARY KEY ("productId")
);

-- CreateTable
CREATE TABLE "InventoryReservation" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "reference" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryReservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryMovement" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "delta" INTEGER NOT NULL,
    "onHandAfter" INTEGER NOT NULL,
    "reservedAfter" INTEGER NOT NULL,
    "reservationId" TEXT,
    "reference" TEXT,
    "note" TEXT,
    "salePrice" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryIssue" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "productId" TEXT,
    "channel" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryIssue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryChannel" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "locationId" TEXT,
    "lastQuantity" INTEGER,
    "checkedAt" TIMESTAMP(3),

    CONSTRAINT "InventoryChannel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventorySync" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "delta" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "expectedQuantity" INTEGER,
    "targetQuantity" INTEGER,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "startedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventorySync_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InventoryReservation_productId_status_idx" ON "InventoryReservation"("productId", "status");

-- CreateIndex
CREATE INDEX "InventoryReservation_reference_status_idx" ON "InventoryReservation"("reference", "status");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryMovement_key_key" ON "InventoryMovement"("key");

-- CreateIndex
CREATE INDEX "InventoryMovement_productId_createdAt_idx" ON "InventoryMovement"("productId", "createdAt");

-- CreateIndex
CREATE INDEX "InventoryMovement_reservationId_action_idx" ON "InventoryMovement"("reservationId", "action");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryIssue_key_key" ON "InventoryIssue"("key");

-- CreateIndex
CREATE INDEX "InventoryIssue_resolvedAt_updatedAt_idx" ON "InventoryIssue"("resolvedAt", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryChannel_productId_channel_key" ON "InventoryChannel"("productId", "channel");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryChannel_channel_externalId_key" ON "InventoryChannel"("channel", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "InventorySync_key_key" ON "InventorySync"("key");

-- CreateIndex
CREATE INDEX "InventorySync_productId_status_createdAt_idx" ON "InventorySync"("productId", "status", "createdAt");

-- AddForeignKey
ALTER TABLE "InventoryStock" ADD CONSTRAINT "InventoryStock_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Preserve existing sold state. Multiple-unit stock must be counted, never inferred from a show worksheet.
INSERT INTO "InventoryStock" ("productId", "onHand", "reserved", "available", "revision", "updatedAt")
SELECT id, CASE WHEN status IN ('sold','archived') THEN 0 ELSE 1 END, 0,
CASE WHEN status IN ('sold','archived') THEN 0 ELSE 1 END, 0, CURRENT_TIMESTAMP FROM "Product";
UPDATE "StreamLineupItem" SET "soldQuantity" = quantity WHERE "soldAt" IS NOT NULL;
ALTER TABLE "InventoryStock" ADD CONSTRAINT "inventory_balance" CHECK ("onHand" >= 0 AND reserved >= 0 AND reserved <= "onHand" AND available = "onHand" - reserved);
ALTER TABLE "InventoryReservation" ADD CONSTRAINT "reservation_quantity" CHECK (quantity >= 0 AND (status != 'active' OR quantity > 0));
