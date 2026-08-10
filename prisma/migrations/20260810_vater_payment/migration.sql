-- Vater payments (2026-08-10): money Trey has actually sent (Zelle) against
-- the render bill. Current due = all-time billing total minus sum(payments).
CREATE TABLE IF NOT EXISTS "VaterPayment" (
    "id" TEXT NOT NULL,
    "amountUsd" DOUBLE PRECISION NOT NULL,
    "method" TEXT NOT NULL DEFAULT 'zelle',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VaterPayment_pkey" PRIMARY KEY ("id")
);
