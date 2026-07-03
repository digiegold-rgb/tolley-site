-- Post-generation editor fields for the Vater / YouTube "review before publish" UI.
-- Scenes + audio already live on YouTubeProject (scenesJson, audioUrl, etc).
-- These columns track edit-time state that's separate from first-run pipeline output.

-- AlterTable
ALTER TABLE "public"."YouTubeProject"
  ADD COLUMN "draftSnapshots" JSONB,
  ADD COLUMN "thumbnailUrl"   TEXT,
  ADD COLUMN "publishedTo"    TEXT[] DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "editedAt"       TIMESTAMP(3);
