-- Per-user Google Drive link + approved-script → Google Doc sync (2026-08-28).
-- ADDITIVE + IDEMPOTENT. One VaterDriveConnection per ROOT login
-- (lib/vater/drive.ts); YouTubeProject.drive* = the mirrored Doc for that
-- project's approved script (lib/vater/drive-sync.ts).
-- Apply:
--   cd ~/tolley-site && npx prisma db execute \
--     --file prisma/migrations/20260828_drive_link/migration.sql \
--     --schema prisma/schema.prisma
ALTER TABLE "YouTubeProject" ADD COLUMN IF NOT EXISTS "driveFileId" TEXT;
ALTER TABLE "YouTubeProject" ADD COLUMN IF NOT EXISTS "driveFileUrl" TEXT;
ALTER TABLE "YouTubeProject" ADD COLUMN IF NOT EXISTS "driveSyncedAt" TIMESTAMP(3);
ALTER TABLE "YouTubeProject" ADD COLUMN IF NOT EXISTS "driveError" TEXT;

CREATE TABLE IF NOT EXISTS "VaterDriveConnection" (
  "id"                   TEXT PRIMARY KEY,
  "userId"               TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "googleEmail"          TEXT,
  "refreshToken"         TEXT NOT NULL,
  "accessToken"          TEXT,
  "accessTokenExpiresAt" TIMESTAMP(3),
  "folderId"             TEXT,
  "folderUrl"            TEXT,
  "status"               TEXT NOT NULL DEFAULT 'active',
  "lastError"            TEXT,
  "createdAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "VaterDriveConnection_userId_key" ON "VaterDriveConnection"("userId");
