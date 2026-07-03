-- Add structured gender field to YouTubeCharacter so identity descriptors
-- carry an explicit token to the renderer instead of relying on the LLM's
-- prose paragraph (which the image model often weighs poorly).
ALTER TABLE "YouTubeCharacter"
  ADD COLUMN "gender" TEXT NOT NULL DEFAULT 'female';

-- Backfill from the descriptor's first sentence. The system prompt already
-- requires "A 2D cartoon [male|female|androgynous] character" as the
-- opening — this regex catches that and any near-variants. Anything we
-- can't classify stays at the default 'female' (fail-safe; can be edited
-- in the UI per character).
UPDATE "YouTubeCharacter"
SET "gender" = 'male'
WHERE "description" ~* '\m(male|man|boy|guy|gentleman|him|his)\M'
  AND "description" !~* '\m(female|woman|girl|lady|her|hers)\M';

UPDATE "YouTubeCharacter"
SET "gender" = 'androgynous'
WHERE "description" ~* '\mandrogynous\M';
