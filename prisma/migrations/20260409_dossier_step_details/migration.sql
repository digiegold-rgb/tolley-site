-- Add per-step execution detail + pipeline phase to DossierJob for
-- live-polling UI visibility and healthier error tracking.

ALTER TABLE "DossierJob"
  ADD COLUMN IF NOT EXISTS "stepDetails" JSONB,
  ADD COLUMN IF NOT EXISTS "currentPhase" TEXT;
