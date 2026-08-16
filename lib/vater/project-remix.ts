/**
 * lib/vater/project-remix.ts
 *
 * One place that knows how to open a NEW YouTubeProject shell, shared by
 * POST /api/vater/youtube/new-from-style and POST /api/vater/youtube/[id]/remix
 * so "start from a style" and "remix this project" can never drift apart.
 *
 * A remix copies the SETUP and nothing else: style (which carries the voice,
 * art style and characters), the soundtrack pick, the length targets and the
 * feature bag. It deliberately does NOT copy the script, transcript, audio,
 * scenes, thumbnail, final video, cost or YouTube id — those belong to the
 * video that was already made. The result is a fresh draft parked at the
 * Script step, which is where the user is sent.
 *
 * Two feature keys are dropped on purpose:
 *   narrationUrl — a BYO narration file matches the OLD script's words.
 *   publishAt    — a schedule belongs to the video it was set on.
 */
import "server-only";
import type { Prisma, YouTubeProject } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/** Feature keys that must not survive into a remix. */
const NON_TRANSFERABLE_FEATURES = ["narrationUrl", "publishAt"] as const;

export type CreateProjectResult =
  | { ok: true; project: YouTubeProject }
  | { ok: false; status: 400 | 403 | 404; error: string };

export interface CreateProjectInput {
  userId: string;
  /** Style to bind. Required unless `source` supplies one. */
  styleId?: string | null;
  /** Project being remixed. Its setup is copied onto the new row. */
  source?: YouTubeProject | null;
}

/**
 * Strip the feature bag down to what may be carried into a new project.
 * Returns undefined when nothing transfers, so the caller can leave the
 * column NULL rather than writing `{}`.
 */
export function transferableFeatures(
  settingsJson: unknown,
): Record<string, unknown> | undefined {
  if (
    !settingsJson ||
    typeof settingsJson !== "object" ||
    Array.isArray(settingsJson)
  ) {
    return undefined;
  }
  const out: Record<string, unknown> = { ...(settingsJson as Record<string, unknown>) };
  for (const key of NON_TRANSFERABLE_FEATURES) delete out[key];
  return Object.keys(out).length > 0 ? out : undefined;
}

/**
 * Create the project shell. Validates style ownership the same way for both
 * entry points: a style must exist and be either a system style or the
 * caller's own.
 */
export async function createProjectFromStyle(
  input: CreateProjectInput,
): Promise<CreateProjectResult> {
  const { userId, source } = input;
  const styleId = input.styleId ?? source?.styleId ?? null;

  if (!styleId) {
    return {
      ok: false,
      status: 400,
      error: source
        ? "That project has no Style attached, so there's nothing to remix from. Open it and pick a Style first."
        : "styleId is required",
    };
  }

  const style = await prisma.youTubeStyle.findUnique({
    where: { id: styleId },
    select: { id: true, userId: true, isSystem: true },
  });
  if (!style) {
    return { ok: false, status: 404, error: "Style not found" };
  }
  if (!style.isSystem && style.userId && style.userId !== userId) {
    return { ok: false, status: 403, error: "Forbidden" };
  }

  // Unchecked (scalar) create: `userId` is a plain nullable column on this
  // model, not a relation, so the connect form isn't available.
  const carried: Prisma.YouTubeProjectUncheckedCreateInput = {
    userId,
    styleId: style.id,
    mode: "topic",
    status: "draft",
    progress: 0,
  };

  if (source) {
    const features = transferableFeatures(source.settingsJson);
    Object.assign(carried, {
      // Voice + look
      voiceName: source.voiceName,
      voiceCloneId: source.voiceCloneId,
      stylePreset: source.stylePreset,
      customStylePrompt: source.customStylePrompt,
      // Soundtrack
      backgroundMusicId: source.backgroundMusicId,
      musicVolume: source.musicVolume,
      sfxEnabled: source.sfxEnabled,
      // Shape of the video
      targetDuration: source.targetDuration,
      targetWordCount: source.targetWordCount,
      animUntilS: source.animUntilS,
      goal: source.goal,
      // Feature bag (aspect, captionPreset, overlays, brandKit, camera,
      // transitions, musicMoods, language, pronunciations).
      ...(features ? { settingsJson: features as Prisma.InputJsonValue } : {}),
      // Give the user something to recognise in the library before they
      // retitle it. `sourceTitle` drives the card heading.
      sourceTitle: source.sourceTitle ? `${source.sourceTitle} (remix)` : null,
    });
  }

  const project = await prisma.youTubeProject.create({ data: carried });
  return { ok: true, project };
}
