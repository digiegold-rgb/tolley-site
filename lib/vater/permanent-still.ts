/**
 * Permanent card stills for Animate.
 *
 * Socials / Library / queue / shorts / publishing used to rest on a
 * `<video>` (or a 🎬 placeholder waiting on IntersectionObserver) when
 * `thumbnailUrl` was null. DGX imports often have only the blob mp4.
 * That stampeded blob.vercel-storage.com and locked the grid.
 *
 * Every video/post card now uses ONE stable path:
 *   /api/vater/youtube/<id>/still
 *   /api/vater/listing/<id>/still
 * The file is written once (copy a scene still / existing thumb / one
 * ffmpeg frame), then served forever with immutable Cache-Control.
 * No signed query strings, no img.youtube.com, no blob: URLs, no
 * per-request frame grab.
 */

export type PermanentStillKind = "youtube" | "listing";

export const PERMANENT_STILL_CACHE_CONTROL =
  "private, max-age=31536000, immutable";

export const STILL_BLOB_PREFIX = "animate-stills";

export function permanentStillUrl(
  kind: PermanentStillKind,
  id: string,
): string {
  if (!id) return "";
  return kind === "listing"
    ? `/api/vater/listing/${id}/still`
    : `/api/vater/youtube/${id}/still`;
}

export function stillBlobKey(kind: PermanentStillKind, id: string): string {
  return `${STILL_BLOB_PREFIX}/${kind}/${id}.jpg`;
}

/** True when an <img> src will expire, 401, or die on reload. */
export function isFragileThumbUrl(url: string | null | undefined): boolean {
  if (typeof url !== "string" || !url.trim()) return true;
  const u = url.trim();
  if (u.startsWith("blob:")) return true;
  if (u.startsWith("data:")) return false;
  if (/img\.youtube\.com/i.test(u)) return true;
  if (/[?&](X-Amz-Expires|X-Amz-Signature|X-Goog-Expires|token=|sig=)/i.test(u)) {
    return true;
  }
  return false;
}

export function isPermanentStillPath(url: string | null | undefined): boolean {
  if (typeof url !== "string") return false;
  return /\/api\/vater\/(youtube|listing)\/[^/]+\/still(?:\?|$)/.test(url);
}

/**
 * First usable still already on the row — never the mp4, never YouTube,
 * never a blob: URL. Persist copies this; the <img> src stays the
 * stable /still path.
 */
export function pickExistingStillSource(input: {
  thumbnailUrl?: string | null;
  firstSceneImage?: string | null;
  stagedStillUrl?: string | null;
  stagedStillLabeledUrl?: string | null;
}): string | null {
  const candidates = [
    input.thumbnailUrl,
    input.firstSceneImage,
    input.stagedStillLabeledUrl,
    input.stagedStillUrl,
  ];
  for (const raw of candidates) {
    if (typeof raw !== "string" || !raw.trim()) continue;
    if (isPermanentStillPath(raw)) continue;
    if (isFragileThumbUrl(raw)) continue;
    if (/\.(mp4|webm|mov)(?:\?|$)/i.test(raw)) continue;
    return raw.trim();
  }
  return null;
}

export type StillSourceKind =
  | "persisted"
  | "thumbnail"
  | "scene"
  | "listing-still"
  | "frame"
  | "none";

export function classifyStillSource(input: {
  hasPersisted?: boolean;
  thumbnailUrl?: string | null;
  firstSceneImage?: string | null;
  stagedStillUrl?: string | null;
  stagedStillLabeledUrl?: string | null;
  finalVideoUrl?: string | null;
}): StillSourceKind {
  if (input.hasPersisted) return "persisted";
  const picked = pickExistingStillSource(input);
  if (picked) {
    if (picked === input.thumbnailUrl) return "thumbnail";
    if (picked === input.firstSceneImage) return "scene";
    return "listing-still";
  }
  if (typeof input.finalVideoUrl === "string" && input.finalVideoUrl.trim()) {
    return "frame";
  }
  return "none";
}
