-- 2026-08-25 (same day as the online rulebook): rule SCOPES. Jared: "extract
-- the principles, replace Vater with Global, let everyone have the rules, but
-- not Jeff Whitfield (Trey's IP); when someone builds a character they get
-- their own subset of rules." Three scopes on the same table:
--   global  — de-branded principles, codes "G<n>", read by EVERY render
--   house   — Trey's studio rulebook (existing rows, backfilled below)
--   owner   — a user's own rules, codes "<ownerId>:<n>", optionally pinned
--             to one character (characterId) and stamped with the template
--             key they were instantiated from.
-- Applied by hand via scripts/tmp-apply-vater-rule-scopes-0825.ts.
ALTER TABLE "VaterRule" ADD COLUMN IF NOT EXISTS "scope" TEXT NOT NULL DEFAULT 'house';
ALTER TABLE "VaterRule" ADD COLUMN IF NOT EXISTS "ownerId" TEXT;
ALTER TABLE "VaterRule" ADD COLUMN IF NOT EXISTS "characterId" TEXT;
ALTER TABLE "VaterRule" ADD COLUMN IF NOT EXISTS "templateKey" TEXT;
UPDATE "VaterRule" SET "scope" = 'house' WHERE "scope" IS NULL OR "scope" = '';
CREATE INDEX IF NOT EXISTS "VaterRule_scope_section_number_idx" ON "VaterRule"("scope", "section", "number");
CREATE INDEX IF NOT EXISTS "VaterRule_ownerId_characterId_idx" ON "VaterRule"("ownerId", "characterId");
