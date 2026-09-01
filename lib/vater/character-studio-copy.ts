/**
 * Copy a character onto another studio (YouTubeStyle) the caller owns.
 *
 * Renders read Postgres YouTubeCharacter rows, which are per-style. The DGX
 * library is already owner-wide; this is the free adopt/upsert that puts the
 * same face on a second style without Qwen /characters/generate or
 * character_import billing.
 *
 * Pure helpers live here so the adopt route and /api/vater/me stay thin and
 * the matching / imageUrl / default-on rules can be unit-tested.
 */

/** Product default: the setting is ON (same spirit as showcase being allowed). */
export const CHARACTER_STUDIO_COPY_DEFAULT = true;

export function readCharacterStudioCopyFlag(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  return CHARACTER_STUDIO_COPY_DEFAULT;
}

export function characterNamesMatch(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

export function findSameNameCharacter<T extends { name: string }>(
  rows: readonly T[],
  name: string,
): T | undefined {
  return rows.find((row) => characterNamesMatch(row.name, name));
}

/**
 * Persist the portrait URL as-is when it is already a site proxy or an
 * absolute URL. Only rewrite a DGX-relative `/vater/file/style/...` path to
 * the authed site proxy — never re-upload or re-mint.
 */
export function resolveAdoptImageUrl(
  imageUrl: string | null | undefined,
): string | null {
  const raw = (imageUrl || "").trim();
  if (!raw) return null;
  if (raw.startsWith("/api/vater/file/")) return raw;
  const m = raw.match(
    /\/vater\/file\/style\/([a-zA-Z0-9_-]+)\/([a-zA-Z0-9_.-]+)$/,
  );
  if (m) return `/api/vater/file/style/${m[1]}/${m[2]}`;
  return raw.includes("://") ? raw : null;
}

export function canCopyOntoStyle(style: {
  isSystem: boolean;
  userId: string | null;
  ownerUserId: string;
}): boolean {
  if (style.isSystem) return false;
  if (!style.userId || style.userId !== style.ownerUserId) return false;
  return true;
}
