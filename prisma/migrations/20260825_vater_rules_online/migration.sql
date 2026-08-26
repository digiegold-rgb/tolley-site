-- 2026-08-25: online Vater rulebook. The 157 numbered rules lived only in
-- ~/vater-studio/VATER-RULES.md on the DGX; Trey could not edit them and no
-- render read them. This table is the source of truth from now on: the
-- /animate Rules screen edits it, GET /api/vater/rules serves it, and every
-- render (planner, Fable runner, delivery audit) fetches it fail-closed and
-- records the content-hash version. Applied by hand (this repo applies
-- migrations manually) via scripts/tmp-apply-vater-rules-0825.ts.
CREATE TABLE IF NOT EXISTS "VaterRule" (
  "id"           TEXT PRIMARY KEY,
  "code"         TEXT NOT NULL,
  "number"       INTEGER NOT NULL,
  "suffix"       TEXT NOT NULL DEFAULT '',
  "section"      INTEGER NOT NULL,
  "sectionTitle" TEXT NOT NULL,
  "title"        TEXT NOT NULL,
  "body"         TEXT NOT NULL DEFAULT '',
  "source"       TEXT,
  "gate"         TEXT NOT NULL DEFAULT 'info',
  "retiredAt"    TIMESTAMP(3),
  "retiredNote"  TEXT,
  "updatedBy"    TEXT,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "VaterRule_code_key" ON "VaterRule"("code");
CREATE INDEX IF NOT EXISTS "VaterRule_section_number_idx" ON "VaterRule"("section", "number");

CREATE TABLE IF NOT EXISTS "VaterRuleRevision" (
  "id"        TEXT PRIMARY KEY,
  "code"      TEXT NOT NULL,
  "before"    JSONB,
  "after"     JSONB NOT NULL,
  "by"        TEXT NOT NULL,
  "note"      TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "VaterRuleRevision_code_createdAt_idx" ON "VaterRuleRevision"("code", "createdAt");
