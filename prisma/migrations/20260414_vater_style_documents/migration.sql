-- TubeGen-parity Style document (2026-04-14)
-- Additive only. Existing rows continue to work via legacy stylePreset path.
-- Phase 1 of the upgrade per /home/jelly/.claude/plans/tubegen-upgrade-MASTER.md

-- CreateTable: CustomArtStyle
CREATE TABLE "public"."CustomArtStyle" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "referenceImageUrls" TEXT[],
    "thumbnailUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomArtStyle_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CustomArtStyle_userId_idx" ON "public"."CustomArtStyle"("userId");

-- CreateTable: YouTubeStyle
CREATE TABLE "public"."YouTubeStyle" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "emoji" TEXT NOT NULL DEFAULT '🎨',
    "voice" TEXT NOT NULL DEFAULT 'MorganDeep',
    "voiceCloneId" TEXT,
    "voiceSpeed" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "voiceStability" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "voiceSimilarity" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "voiceExaggeration" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "voiceBackend" TEXT NOT NULL DEFAULT 'f5-tts',
    "language" TEXT NOT NULL DEFAULT 'en',
    "defaultWordCount" INTEGER NOT NULL DEFAULT 1500,
    "scriptMode" TEXT NOT NULL DEFAULT 'default',
    "webSearchDefault" BOOLEAN NOT NULL DEFAULT false,
    "additionalContext" TEXT,
    "referenceTranscripts" JSONB,
    "artStylePresetId" TEXT NOT NULL DEFAULT 'cinematic',
    "customArtStyleId" TEXT,
    "defaultAspectRatio" TEXT NOT NULL DEFAULT '16x9',
    "defaultQuality" TEXT NOT NULL DEFAULT 'sdxl-local',
    "defaultVisualType" TEXT NOT NULL DEFAULT 'images',
    "defaultAnimMode" TEXT NOT NULL DEFAULT 'none',
    "defaultAnimMin" INTEGER NOT NULL DEFAULT 2,
    "defaultAnimMax" INTEGER NOT NULL DEFAULT 8,
    "defaultPacingSec" DOUBLE PRECISION,
    "defaultConsistency" INTEGER NOT NULL DEFAULT 0,
    "enableCharts" BOOLEAN NOT NULL DEFAULT false,
    "enableMaps" BOOLEAN NOT NULL DEFAULT false,
    "enableAutoHeaders" BOOLEAN NOT NULL DEFAULT false,
    "overlayTheme" TEXT NOT NULL DEFAULT 'dark',
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "clonedFromId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "YouTubeStyle_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "YouTubeStyle_userId_idx" ON "public"."YouTubeStyle"("userId");
CREATE INDEX "YouTubeStyle_isSystem_idx" ON "public"."YouTubeStyle"("isSystem");

-- CreateTable: YouTubeCharacter
CREATE TABLE "public"."YouTubeCharacter" (
    "id" TEXT NOT NULL,
    "styleId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "briefDescription" TEXT,
    "imageUrl" TEXT,
    "imageKey" TEXT,
    "permanent" BOOLEAN NOT NULL DEFAULT true,
    "placeInEveryImage" BOOLEAN NOT NULL DEFAULT false,
    "customArtStyleId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "YouTubeCharacter_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "YouTubeCharacter_styleId_idx" ON "public"."YouTubeCharacter"("styleId");

-- AlterTable: YouTubeProject — additive nullable FK
ALTER TABLE "public"."YouTubeProject" ADD COLUMN "styleId" TEXT;

CREATE INDEX "YouTubeProject_styleId_idx" ON "public"."YouTubeProject"("styleId");

-- AddForeignKey
ALTER TABLE "public"."YouTubeStyle"
    ADD CONSTRAINT "YouTubeStyle_customArtStyleId_fkey"
    FOREIGN KEY ("customArtStyleId") REFERENCES "public"."CustomArtStyle"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "public"."YouTubeStyle"
    ADD CONSTRAINT "YouTubeStyle_clonedFromId_fkey"
    FOREIGN KEY ("clonedFromId") REFERENCES "public"."YouTubeStyle"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "public"."YouTubeCharacter"
    ADD CONSTRAINT "YouTubeCharacter_styleId_fkey"
    FOREIGN KEY ("styleId") REFERENCES "public"."YouTubeStyle"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."YouTubeProject"
    ADD CONSTRAINT "YouTubeProject_styleId_fkey"
    FOREIGN KEY ("styleId") REFERENCES "public"."YouTubeStyle"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
