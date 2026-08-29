-- Video numbers are never reused (2026-08-28). Idempotent.
ALTER TABLE "VaterAccount" ADD COLUMN IF NOT EXISTS "videoNumberMax" INTEGER NOT NULL DEFAULT 0;
-- Seed from what each owner already has.
UPDATE "VaterAccount" a SET "videoNumberMax" = GREATEST(a."videoNumberMax", COALESCE((
  SELECT MAX((regexp_match(p."sourceTitle", '^#([0-9]+) '))[1]::int)
  FROM "YouTubeProject" p WHERE p."userId" = a."userId" AND p."sourceTitle" ~ '^#[0-9]+ '
), 0));
