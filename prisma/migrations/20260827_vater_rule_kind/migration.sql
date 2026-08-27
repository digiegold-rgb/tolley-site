-- Script Rules 2.0 — a second rule bucket on VaterRule (2026-08-27).
--
-- Trey brief, ship item 6: "Two rule buckets he can edit without you. Video
-- rules (what already exists in studio). Script rules (this 2.0 pack). If a
-- rewrite comes out weird, he adds a script rule and reruns."
--
-- `gate` already says what a rule DOES at render time (hard/advisory/planner/
-- info). `kind` is the orthogonal axis it was missing: WHICH STAGE reads it.
--   video  — the existing 260 rows: scene planner, delivery audit, Fable runner
--   script — the 28-rule rewriting pack the script writer injects verbatim
--
-- Additive, defaulted, IF NOT EXISTS: safe on a live database, safe twice, and
-- safe to run BEFORE the matching deploy — code that has never heard of `kind`
-- reads every row exactly as it does today (they are all 'video').
ALTER TABLE "VaterRule" ADD COLUMN IF NOT EXISTS "kind" TEXT NOT NULL DEFAULT 'video';

CREATE INDEX IF NOT EXISTS "VaterRule_kind_scope_idx" ON "VaterRule" ("kind", "scope");
