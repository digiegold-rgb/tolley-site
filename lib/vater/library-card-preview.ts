/**
 * Rest-state preview for a Library card.
 *
 * Finished DGX imports often have `finalVideoUrl` on blob but `thumbnailUrl`
 * NULL and empty `scenesJson`. Those must still show a real frame — never the
 * dim STYLE_PRESET sample that only looks like a thumbnail after hover mounts
 * the mp4. Since 2026-09-02 the DGX poster sweep gives every finished mp4 a
 * permanent `posterUrl` JPEG, which is the preferred rest-state image.
 *
 * This helper is rest-only. Hover-play is a separate UI concern.
 */
export type LibraryCardPreviewKind =
  | "poster"
  | "scene"
  | "thumb"
  | "final-video"
  | "preset"
  | "empty";

function nonEmpty(value: string | null | undefined): value is string {
  return typeof value === "string" && value.length > 0;
}

/**
 * First-scene still URL used by Library cards and Socials thumbs.
 * Pins `variant=image` + scene version so an animated scene 0 does not
 * come back as video/mp4 and blank the rest-state preview.
 */
export function firstScenePreviewUrl(scenesJson: unknown): string | null {
  if (!Array.isArray(scenesJson)) return null;
  const first = scenesJson.find((s) => {
    if (!s || typeof s !== "object") return false;
    const url = (s as { imageUrl?: unknown }).imageUrl;
    return typeof url === "string" && url.length > 0;
  }) as { imageUrl: string; version?: unknown } | undefined;
  if (!first) return null;
  const version =
    typeof first.version === "number" && first.version >= 0 ? first.version : 0;
  const join = first.imageUrl.includes("?") ? "&" : "?";
  return `${first.imageUrl}${join}variant=image&v=${version}`;
}

export function libraryCardPreviewKind(input: {
  /**
   * Permanent JPEG cut from the final mp4 (lib/vater/poster.ts). Wins over
   * everything: it is the actual video, it is a plain <img>, and it exists
   * for finished DGX imports that have no scenes and no thumbnail.
   */
  posterUrl?: string | null;
  firstSceneImage?: string | null;
  thumbnailUrl?: string | null;
  finalVideoUrl?: string | null;
  hasPresetSample?: boolean;
}): LibraryCardPreviewKind {
  if (nonEmpty(input.posterUrl)) return "poster";
  if (nonEmpty(input.firstSceneImage)) return "scene";
  if (nonEmpty(input.thumbnailUrl)) return "thumb";
  if (nonEmpty(input.finalVideoUrl)) return "final-video";
  if (input.hasPresetSample) return "preset";
  return "empty";
}
