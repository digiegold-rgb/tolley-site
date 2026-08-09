-- Short-form promo cut for Vater long-forms (Trey 2026-08-09): vertical
-- preview video + its cross-post description linking the published YouTube URL.
ALTER TABLE "YouTubeProject" ADD COLUMN IF NOT EXISTS "shortVideoUrl" TEXT;
ALTER TABLE "YouTubeProject" ADD COLUMN IF NOT EXISTS "shortDescription" TEXT;
