-- YouTubeStyle.defaultQuality — 2026-08-23.
--
-- "firered-local" (FireRed-Image-Edit on the DGX's own GPU) is gone: the q4 GGUF
-- is no longer on disk and the studio is Modal-only. Styles created through the
-- legacy editor / API inherited the column default and every render on them
-- failed at scene 1 ("unet_name … not in list") after TTS + planner spend —
-- found by the fable5-runner proof ticket F5-3VM8N4.
ALTER TABLE "YouTubeStyle" ALTER COLUMN "defaultQuality" SET DEFAULT 'firered-modal';
UPDATE "YouTubeStyle" SET "defaultQuality" = 'firered-modal' WHERE "defaultQuality" = 'firered-local';
