/**
 * lib/vater/video-id.ts
 *
 * Extract a YouTube video id from any of the URL shapes users paste
 * (watch?v=, youtu.be/, shorts/, embed/, live/ — with or without extra
 * query params like ?si= share trackers). Returns null for non-YouTube
 * URLs so callers can fall back to exact-URL comparison.
 */
const YT_ID_RE =
  /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/;

export function extractYouTubeVideoId(url: string): string | null {
  const m = YT_ID_RE.exec(url.trim());
  return m ? m[1] : null;
}
