-- Live AI-spend rows pushed daily by the DGX collector; merged over the
-- static baseline in lib/ai-pnl.ts by the /hq AI P&L pill.
-- Also: imageCents on VideoCost — Nano Banana 2 keyframe (photo) cost per video.

CREATE TABLE IF NOT EXISTS "AiSpendLive" (
  "id"          TEXT NOT NULL,
  "provider"    TEXT NOT NULL,
  "label"       TEXT NOT NULL,
  "amountCents" INTEGER NOT NULL DEFAULT 0,
  "kind"        TEXT NOT NULL DEFAULT 'verified',
  "note"        TEXT,
  "asOf"        TIMESTAMP(3) NOT NULL,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AiSpendLive_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "AiSpendLive_provider_key" ON "AiSpendLive"("provider");

ALTER TABLE "VideoCost"
  ADD COLUMN IF NOT EXISTS "imageCents" INTEGER NOT NULL DEFAULT 0;
