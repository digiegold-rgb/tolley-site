/**
 * lib/vater/script-gate.ts
 *
 * Shared run-creation kickoff for the Script Review pipeline (2026-08-08).
 *
 * The gate splits what used to be one DGX call into two:
 *   1. `script-from-reference` runs with `stopAfterScript` — the worker parks
 *      at the `script_ready` phase having spent nothing on audio or images.
 *   2. `approve-script` re-runs with the human-approved text as
 *      `scriptOverride` — the worker skips principles + scripting and goes
 *      straight to the render.
 *
 * Both calls need the same style snapshot + voice + hybrid-animation window,
 * so that assembly lives here instead of being copied into each route.
 * `/context` keeps its own inline copy: it also handles the interactive
 * context form's per-request overrides (animMode, cloudRental, imageQuality)
 * that neither gate route exposes.
 */
import "server-only";
import type { YouTubeProject } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { autopilot, type StyleSnapshot } from "./autopilot-client";
import { buildStyleSnapshot } from "./style-snapshot";

/** Thrown when the project row is missing something the DGX requires. */
export class ScriptGateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ScriptGateError";
  }
}

export interface StartRunCreationOptions {
  /** Park after the script so a human can approve it. Mutually exclusive
   *  with `scriptOverride` in practice — the approval call supplies text. */
  stopAfterScript?: boolean;
  /** Approved script text. Makes the worker skip principles + scripting. */
  scriptOverride?: string;
}

/**
 * Kick `/vater/run-creation` for a project row and return the DGX job id.
 * Throws `ScriptGateError` for bad project state and `AutopilotError` for
 * transport failures — callers surface both verbatim.
 */
export async function startRunCreation(
  project: YouTubeProject,
  opts: StartRunCreationOptions = {},
): Promise<string> {
  let styleSnapshot: StyleSnapshot | undefined;
  if (project.styleId) {
    const style = await prisma.youTubeStyle.findUnique({
      where: { id: project.styleId },
      include: { characters: true, customArtStyle: true },
    });
    if (!style) {
      throw new ScriptGateError(
        `Project style ${project.styleId} no longer exists`,
      );
    }
    styleSnapshot = buildStyleSnapshot(style);
  }

  // The voice clone name the DGX loads. The project row wins (the user may
  // have overridden it) and the style is the fallback.
  const voiceCloneName = project.voiceName || styleSnapshot?.voice;
  if (!voiceCloneName) {
    throw new ScriptGateError(
      "Project has no voice — pick a voice (or a style that sets one) first",
    );
  }

  // Hybrid render window: animate the first N seconds, Ken Burns the rest.
  // `defaultAnimUntilS` isn't on StyleSnapshot — the DGX reads it out of the
  // style dict by key, so widen through `unknown` the way /context does.
  const animUntilS =
    typeof project.animUntilS === "number" && project.animUntilS > 0
      ? project.animUntilS
      : null;
  const style: StyleSnapshot | undefined = animUntilS
    ? ({
        ...(styleSnapshot ?? {}),
        defaultAnimUntilS: animUntilS,
      } as unknown as StyleSnapshot)
    : styleSnapshot;

  const scriptOverride = opts.scriptOverride?.trim() || undefined;
  const targetWordCount = scriptOverride
    ? Math.max(1, scriptOverride.split(/\s+/).filter(Boolean).length)
    : project.targetWordCount || project.targetDuration * 150;

  const job = await autopilot.runCreation({
    projectId: project.id,
    mode: project.transcript ? "transcribe" : "topic",
    transcript: project.transcript ?? undefined,
    topic: project.topic ?? undefined,
    goal: project.goal || project.sourceTitle || "Original video from reference",
    targetWordCount,
    stylePreset: project.stylePreset,
    voiceCloneName,
    customStylePrompt: project.customStylePrompt ?? undefined,
    backgroundMusicId: project.backgroundMusicId ?? undefined,
    musicVolume: project.musicVolume ?? undefined,
    style,
    ...(scriptOverride ? { scriptOverride } : {}),
    ...(opts.stopAfterScript ? { stopAfterScript: true } : {}),
  });

  return job.jobId;
}
