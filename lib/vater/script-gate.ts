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
import { ownerFieldsForProject } from "./owner-tier";
import {
  elevenLabsKeyMissing,
  ELEVENLABS_KEY_REQUIRED,
} from "./elevenlabs-key-gate";

/**
 * `settingsJson` doubles as the home of the Fable 5 Concierge ticket
 * (`engine`, `concierge` — lib/vater/concierge.ts). Those keys are site-side
 * bookkeeping, not render features; the DGX must never see them.
 */
function stripServerOwnedFeatures(bag: object): Record<string, unknown> {
  const { engine: _engine, concierge: _concierge, ...features } =
    bag as Record<string, unknown>;
  void _engine;
  void _concierge;
  return features;
}

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

  // A project-level voice is always a local clone name ("Monroe"), never an
  // ElevenLabs voice id. Styles saved before the local-only voice roster
  // still carry voiceBackend "elevenlabs" + an EL id, and sending a local
  // name to that backend 404s the whole render at the TTS step. The voice we
  // actually send decides the backend, so drop the style's EL routing and
  // tuning params whenever the project overrides the voice.
  const projectVoiceOverride =
    !!project.voiceName && project.voiceName !== styleSnapshot?.voice;
  if (projectVoiceOverride && styleSnapshot) {
    styleSnapshot = {
      ...styleSnapshot,
      voice: project.voiceName!,
      // Drop ElevenLabs routing, but never demote a Modal style to the local
      // GPU lane (vater-modal-only-never-local-gpu).
      voiceBackend:
        styleSnapshot.voiceBackend === "elevenlabs"
          ? "indextts-modal"
          : styleSnapshot.voiceBackend,
    };
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

  // Per-tenant fairness + script cap (content-autopilot 9cbe9a6). Resolved
  // from the project row so every caller — /approve-script,
  // /script-from-reference and the course pipeline — gets it for free.
  const ownerFields = await ownerFieldsForProject(project.userId);

  // ElevenLabs is bring-your-own-key (2026-08-17): refuse here, for free,
  // rather than at the TTS step after the images have been paid for.
  if (
    style?.voiceBackend === "elevenlabs" &&
    (await elevenLabsKeyMissing(project.userId))
  ) {
    throw new ScriptGateError(ELEVENLABS_KEY_REQUIRED);
  }

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
    ...ownerFields,
    ...(scriptOverride ? { scriptOverride } : {}),
    ...(opts.stopAfterScript ? { stopAfterScript: true } : {}),
    // Optional feature bag (jelly-feature-contract 2026-08-16), sent verbatim
    // so the approval path renders with the same captions / overlays / camera
    // / brand kit the editor showed. Unknown keys are ignored by the worker;
    // a NULL column sends nothing at all, which is today's behavior.
    ...(project.settingsJson &&
    typeof project.settingsJson === "object" &&
    !Array.isArray(project.settingsJson)
      ? { features: stripServerOwnedFeatures(project.settingsJson) }
      : {}),
  });

  return job.jobId;
}
