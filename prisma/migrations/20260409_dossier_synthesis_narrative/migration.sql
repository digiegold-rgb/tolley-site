-- Add OpenManus synthesis narrative fields to DossierResult.
--
-- After the 28 dossier plugins finish gathering structured evidence, a new
-- `synthesis-narrative` step in lib/dossier/pipeline.ts hands everything to
-- OpenManus which writes a 500-1000 word investment narrative with a
-- concrete BUY / NEGOTIATE / PASS verdict.
--
-- Both columns are nullable:
--   * narrativeReport stays NULL if synthesis is still running, times out,
--     or if OpenManus is unreachable — dossier completes either way.
--   * narrativeMeta holds task-id / step-count / duration for debugging
--     and RAG lookup.
--
-- Additive only. Existing rows get NULL. Existing code paths are unaffected.

ALTER TABLE "DossierResult"
  ADD COLUMN "narrativeReport" TEXT,
  ADD COLUMN "narrativeMeta"   JSONB;
