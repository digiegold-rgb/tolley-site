/**
 * lib/vater/locked-style.ts
 *
 * The one animation style Vater videos are allowed to use (2026-08-10, Trey).
 *
 * The Script Review screen no longer offers a style picker: every video ships
 * in the locked "Jeff Whitfield 3-D style" — preset `pixar` + the "Finance
 * Pixar 3D" custom art style + Wan2.2 Animate-2 motion + the locked Jeff
 * Whitfield host character + the Monroe voice. That bundle lives on ONE
 * YouTubeStyle row; this module is the single place that finds it, so the
 * UI, the intake route, and the render kickoff can never disagree about
 * which row "the locked style" means.
 *
 * Resolution order:
 *   1. `VATER_LOCKED_STYLE_ID` env — explicit pin, wins outright.
 *   2. The caller's own style whose name starts with "Jeff Whitfield".
 *   3. The caller's most recently updated style that carries the Finance
 *      Pixar 3D art style (covers a row renamed by hand).
 *
 * Returns null when the user has no such row — callers surface that as a
 * setup error rather than silently rendering in some other look.
 */
import "server-only";
import { prisma } from "@/lib/prisma";
import { readBrandKit, type FeatureBrandKit } from "./project-features";

/** Display name of the locked style. The DB row is renamed to match. */
export const LOCKED_STYLE_NAME = "Jeff Whitfield 3-D style";

/** The custom art style the locked bundle is built on. */
export const LOCKED_ART_STYLE_NAME = "Finance Pixar 3D";

export interface LockedStyle {
  id: string;
  name: string;
  voice: string;
  artStylePresetId: string;
  customArtStyleName: string | null;
  characterNames: string[];
  /** Brand kit on the locked row, when one is set. Null = default look. */
  brandKit: FeatureBrandKit | null;
}

export async function resolveLockedStyle(
  userId: string,
): Promise<LockedStyle | null> {
  const select = {
    id: true,
    name: true,
    voice: true,
    artStylePresetId: true,
    brandKitJson: true,
    customArtStyle: { select: { name: true } },
    characters: { select: { name: true }, orderBy: { createdAt: "asc" } },
  } as const;

  const pinned = process.env.VATER_LOCKED_STYLE_ID?.trim();
  if (pinned) {
    const row = await prisma.youTubeStyle.findUnique({
      where: { id: pinned },
      select,
    });
    if (row) return shape(row);
  }

  const byName = await prisma.youTubeStyle.findFirst({
    where: { userId, name: { startsWith: "Jeff Whitfield" } },
    orderBy: { updatedAt: "desc" },
    select,
  });
  if (byName) return shape(byName);

  const byArtStyle = await prisma.youTubeStyle.findFirst({
    where: {
      userId,
      customArtStyle: { name: LOCKED_ART_STYLE_NAME },
    },
    orderBy: { updatedAt: "desc" },
    select,
  });
  return byArtStyle ? shape(byArtStyle) : null;
}

function shape(row: {
  id: string;
  name: string;
  voice: string;
  artStylePresetId: string;
  brandKitJson: unknown;
  customArtStyle: { name: string } | null;
  characters: { name: string }[];
}): LockedStyle {
  return {
    id: row.id,
    name: row.name,
    voice: row.voice,
    artStylePresetId: row.artStylePresetId,
    customArtStyleName: row.customArtStyle?.name ?? null,
    characterNames: row.characters.map((c) => c.name),
    brandKit: readBrandKit(row.brandKitJson),
  };
}
