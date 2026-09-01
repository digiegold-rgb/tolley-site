/**
 * Rest-state preview for a Library card.
 *
 * Finished DGX imports often have `finalVideoUrl` on blob but `thumbnailUrl`
 * NULL and empty `scenesJson`. Those must still show a real frame — never the
 * dim STYLE_PRESET sample that only looks like a thumbnail after hover mounts
 * the mp4.
 *
 * This helper is rest-only. Hover-play is a separate UI concern.
 */
export type LibraryCardPreviewKind =
  | "scene"
  | "thumb"
  | "final-video"
  | "preset"
  | "empty";

function nonEmpty(value: string | null | undefined): value is string {
  return typeof value === "string" && value.length > 0;
}

export function libraryCardPreviewKind(input: {
  firstSceneImage?: string | null;
  thumbnailUrl?: string | null;
  finalVideoUrl?: string | null;
  hasPresetSample?: boolean;
}): LibraryCardPreviewKind {
  if (nonEmpty(input.firstSceneImage)) return "scene";
  if (nonEmpty(input.thumbnailUrl)) return "thumb";
  if (nonEmpty(input.finalVideoUrl)) return "final-video";
  if (input.hasPresetSample) return "preset";
  return "empty";
}
