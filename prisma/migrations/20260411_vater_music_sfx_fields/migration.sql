-- AlterTable
ALTER TABLE "public"."YouTubeProject" ADD COLUMN     "backgroundMusicId" TEXT,
ADD COLUMN     "musicVolume" DOUBLE PRECISION DEFAULT 0.18,
ADD COLUMN     "sfxEnabled" BOOLEAN NOT NULL DEFAULT false;

