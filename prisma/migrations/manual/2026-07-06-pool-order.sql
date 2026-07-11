-- Pool supply orders: fulfillment record for /pools Stripe checkouts.
-- Before this table existed, pools payments landed in Stripe with no order
-- record, stock decrement, or notification (CTO audit 2026-07-06, Tier 1 #1).
CREATE TABLE IF NOT EXISTS "PoolOrder" (
    "id" TEXT NOT NULL,
    "stripeSessionId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'paid',
    "amountTotal" DOUBLE PRECISION NOT NULL,
    "customerEmail" TEXT,
    "customerName" TEXT,
    "customerPhone" TEXT,
    "shippingAddress" JSONB,
    "items" JSONB NOT NULL,
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PoolOrder_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PoolOrder_stripeSessionId_key" ON "PoolOrder"("stripeSessionId");
CREATE INDEX IF NOT EXISTS "PoolOrder_status_idx" ON "PoolOrder"("status");
CREATE INDEX IF NOT EXISTS "PoolOrder_createdAt_idx" ON "PoolOrder"("createdAt");
