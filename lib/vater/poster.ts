/**
 * Permanent tile posters for Library / Socials (2026-09-02).
 *
 * Why: 157 of 210 finished projects had no still at all (thumbnailUrl NULL,
 * no scene images), so every tile depended on lazily mounting the final mp4
 * behind an IntersectionObserver and a 6-slot gate. Offscreen = 🎬
 * placeholder, on-screen = a black fade-in frame until the seek landed. The
 * fix is a real JPEG per final mp4, generated once on the DGX
 * (scripts/vater-poster-sweep.ts), stored on public Vercel Blob, and rendered
 * as a plain <img>.
 *
 * The poster carries the final's version tag in its `?v=` so a re-compose
 * (new `finalVideoUrl?v=`) is detected and the poster regenerated. A stale
 * poster is still shown until the sweep catches up — better than blank.
 *
 * Pure helpers only; no I/O here.
 */

export const POSTER_BLOB_PREFIX = "vater-posters/";
/** Long edge of the stored JPEG. Tiles are ≤ ~400px wide; 640 covers 2x. */
export const POSTER_LONG_EDGE = 640;

function versionParam(url: string | null | undefined): string | null {
  if (typeof url !== "string" || url.length === 0) return null;
  const q = url.indexOf("?");
  if (q === -1) return null;
  const v = new URLSearchParams(url.slice(q + 1)).get("v");
  return v && v.length > 0 ? v : null;
}

/** Small stable hash for URLs without a `?v=` cache-buster. */
function fnv1a(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(36);
}

/**
 * Version tag of a final mp4: its `?v=` when present, else a hash of the URL
 * so a re-upload under a new key still counts as a new version.
 */
export function finalVersionTag(finalVideoUrl: string | null | undefined): string | null {
  if (typeof finalVideoUrl !== "string" || finalVideoUrl.length === 0) return null;
  return versionParam(finalVideoUrl) ?? `h${fnv1a(finalVideoUrl)}`;
}

/** Version tag a stored poster was generated for (its `?v=`). */
export function posterVersionTag(posterUrl: string | null | undefined): string | null {
  return versionParam(posterUrl);
}

export function isPublicBlobUrl(url: string | null | undefined): boolean {
  if (typeof url !== "string" || !url.startsWith("https://")) return false;
  try {
    return new URL(url).hostname.endsWith(".public.blob.vercel-storage.com");
  } catch {
    return false;
  }
}

/**
 * True when the sweep should (re)generate a poster: there is a public final
 * mp4 and either no poster yet or one made for a different final version.
 * Non-blob finals (DGX proxy paths) are skipped — ffmpeg can't fetch them.
 */
export function posterNeedsRefresh(input: {
  finalVideoUrl: string | null | undefined;
  posterUrl: string | null | undefined;
}): boolean {
  if (!isPublicBlobUrl(input.finalVideoUrl)) return false;
  const want = finalVersionTag(input.finalVideoUrl);
  if (!want) return false;
  const have = posterVersionTag(input.posterUrl);
  return have !== want;
}

export function posterBlobKey(projectId: string): string {
  return `${POSTER_BLOB_PREFIX}${projectId}.jpg`;
}

/** Stored value: blob URL pinned to the final version it was cut from. */
export function posterUrlFor(blobUrl: string, finalVideoUrl: string): string {
  const base = blobUrl.split("?")[0];
  return `${base}?v=${finalVersionTag(finalVideoUrl) ?? "0"}`;
}

/**
 * Where to grab the poster frame. DGX renders fade in from black, so stay
 * ≥1.2s in; prefer ~15% for a representative frame; cap at 3s and never past
 * 40% of a short clip.
 */
export function posterFrameTime(duration: number | null | undefined): number {
  if (typeof duration !== "number" || !Number.isFinite(duration) || duration <= 0) return 1.2;
  const preferred = Math.min(3, Math.max(1.2, duration * 0.15));
  return Math.max(0.1, Math.min(preferred, duration * 0.4));
}

/** ffmpeg scale filter: long edge = POSTER_LONG_EDGE, even dimensions. */
export function posterScaleFilter(longEdge = POSTER_LONG_EDGE): string {
  return `scale=w='if(gte(iw,ih),${longEdge},-2)':h='if(gte(iw,ih),-2,${longEdge})'`;
}
