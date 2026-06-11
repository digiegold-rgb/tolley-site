/**
 * POST /api/vater/youtube/[id]/context
 *
 * Called from <YouTubeContextForm> after the user reviews their transcript
 * and decides what they want the final video to be.
 *
 * Body: {
 *   goal: string,
 *   targetDuration: number,         // minutes
 *   targetWordCount: number,        // overrides duration*150 if provided
 *   stylePreset: string,            // one of 8 preset ids
 *   voiceCloneName: string,         // matches a VaterVoiceClone.name
 *   customStylePrompt?: string,
 * }
 *
 * Flips status `transcribed` → `extracting_principles` and kicks off
 * the autopilot run-creation worker. The returned jobId is stored on
 * `project.autopilotJobId` for the poll route to consume.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  autopilot,
  AutopilotError,
  type RunCreationInput,
  type StyleSnapshot,
} from "@/lib/vater/autopilot-client";
import {
  isStylePresetId,
  DEFAULT_STYLE_PRESET,
} from "@/lib/vater/style-presets";
import { buildStyleSnapshot } from "@/lib/vater/style-snapshot";
import { auth } from "@/auth";
import { canAccessProject } from "@/lib/vater/project-access";
import { checkBudget } from "@/lib/vater/billing/check-budget";

type Ctx = { params: Promise<{ id: string }> };

interface ContextBody {
  goal?: string;
  targetDuration?: number;
  targetWordCount?: number;
  stylePreset?: string;
  voiceCloneName?: string;
  customStylePrompt?: string;
  backgroundMusicId?: string | null;
  musicVolume?: number | null;
  creatorModelId?: string;
  scriptGuidelines?: string;
  consistency?: number;
  videoBackend?: string;
  /** TubeGen-parity animation mode. Controls the i2v stage on the DGX.
   *  "none" skips animation (default), "all"/"longer-only"/"per-scene"
   *  convert selected stills into MP4 clips before compose. */
  animMode?: "none" | "all" | "longer-only" | "per-scene";
  /** Quality tier for i2v: turbo/default/default_1080p/high/ltx-local. */
  animQuality?: "turbo" | "default" | "default_1080p" | "high" | "ltx-local";
  /** Phase 1+: opt-in YouTubeStyle id. When present, style snapshot
   *  takes precedence over stylePreset for fields it sets. */
  styleId?: string | null;
  /** Cloud rental: when true, force the paid pipeline — Gemini cloud stills
   *  (instead of local SDXL) and Modal L40S animation (instead of local
   *  Wan22). Lets the user trade DGX time for predictable cloud spend so
   *  long-form runs don't hog the box. */
  cloudRental?: boolean;
  /** Image renderer override — when set, overrides Style.defaultQuality and
   *  cloudRental's auto-pick. Lets the user choose the slide model directly
   *  (firered-local, firered-modal, firered-modal-fast, gemini-1k, gemini-2k,
   *  ideogram-*, sdxl-local). */
  imageQuality?: string;
  /** Pre-written script. When set, the worker uses it verbatim and skips
   *  principle extraction + script generation. No min length enforced.
   *  Goal becomes optional metadata when this is provided. */
  scriptOverride?: string;
}

export async function POST(req: NextRequest, ctx: Ctx) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;

  let body: ContextBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const scriptOverride =
    typeof body.scriptOverride === "string" && body.scriptOverride.trim()
      ? body.scriptOverride.trim()
      : null;

  // Goal is required only when DGX is generating the script. With a
  // user-supplied script, goal becomes optional metadata.
  if (!scriptOverride && (!body.goal || typeof body.goal !== "string")) {
    return NextResponse.json(
      { error: "goal is required" },
      { status: 400 },
    );
  }
  if (!body.voiceCloneName || typeof body.voiceCloneName !== "string") {
    return NextResponse.json(
      { error: "voiceCloneName is required" },
      { status: 400 },
    );
  }

  const project = await prisma.youTubeProject.findUnique({ where: { id } });
  if (
    !project ||
    !canAccessProject(project.userId, session.user.id, session.user.email)
  ) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  // ── Billing gate: run-creation generates the scene plan + images. The
  // exact scene count isn't knowable at kickoff, so gate at one scene image
  // (25¢, action "scene"). The actual charges (script + voiceover + per-scene
  // images) are recorded by the poll route once the job is confirmed done,
  // idempotent per jobId — kickoff never bills.
  const budget = await checkBudget(session.user.id, "scene");
  if (!budget.allow) {
    return NextResponse.json(
      { error: "Billing check failed", budget },
      { status: 402 },
    );
  }

  // Status gate: normal transcribe-mode requires a finished transcript.
  // When the user is supplying their own script, we let "draft" / "scripted"
  // through too — the worker skips principle extraction + script generation
  // and uses the override verbatim. Mirrors the V1 topic-form path.
  const allowOwnScriptKickoff =
    !!scriptOverride &&
    (project.status === "draft" || project.status === "scripted");
  if (project.status !== "transcribed" && !allowOwnScriptKickoff) {
    return NextResponse.json(
      {
        error: `Project must be in 'transcribed' status to submit context, currently '${project.status}'`,
      },
      { status: 409 },
    );
  }
  if (!scriptOverride && !project.transcript) {
    return NextResponse.json(
      { error: "Project has no transcript yet" },
      { status: 409 },
    );
  }

  const targetDuration =
    typeof body.targetDuration === "number" && body.targetDuration > 0
      ? Math.min(30, Math.max(1, Math.round(body.targetDuration)))
      : project.targetDuration || 10;

  // When the user supplies their own script, the actual word count IS the
  // script length — duration sliders become advisory.
  const overrideWordCount = scriptOverride
    ? scriptOverride.split(/\s+/).filter(Boolean).length
    : 0;
  const targetWordCount = scriptOverride
    ? Math.max(1, overrideWordCount)
    : typeof body.targetWordCount === "number" && body.targetWordCount > 0
      ? Math.round(body.targetWordCount)
      : targetDuration * 150;

  const effectiveGoal =
    typeof body.goal === "string" && body.goal.trim()
      ? body.goal.trim()
      : "User-supplied script";

  const stylePreset =
    body.stylePreset && isStylePresetId(body.stylePreset)
      ? body.stylePreset
      : DEFAULT_STYLE_PRESET;

  // Optional music picker (frontend sends backgroundMusicId from /vater/music-catalog)
  const backgroundMusicId =
    typeof body.backgroundMusicId === "string" && body.backgroundMusicId.trim()
      ? body.backgroundMusicId.trim()
      : null;
  const musicVolume =
    typeof body.musicVolume === "number" && Number.isFinite(body.musicVolume)
      ? Math.max(0, Math.min(1, body.musicVolume))
      : 0.18;

  // Phase 1: opt-in YouTubeStyle. When body.styleId is set, load the row
  // and build a snapshot; the snapshot rides inline in the runCreation
  // payload so the DGX worker has everything (no callback). When NULL, we
  // stay on the legacy stylePreset path — fully back-compat.
  const styleId =
    typeof body.styleId === "string" && body.styleId.trim()
      ? body.styleId.trim()
      : null;

  let styleSnapshot: StyleSnapshot | undefined;
  if (styleId) {
    const style = await prisma.youTubeStyle.findUnique({
      where: { id: styleId },
      include: { characters: true, customArtStyle: true },
    });
    if (!style) {
      return NextResponse.json(
        { error: `styleId ${styleId} not found` },
        { status: 404 },
      );
    }
    // System styles (userId=null) are public-read; user styles must be owned.
    if (style.userId && style.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    styleSnapshot = buildStyleSnapshot(style);
  }

  // Persist the context fields up front so the UI sees them even if the
  // autopilot call fails. With a user-supplied script we jump straight past
  // principle extraction — the project is already "scripted".
  const updated = await prisma.youTubeProject.update({
    where: { id },
    data: {
      goal: effectiveGoal,
      targetDuration,
      targetWordCount,
      stylePreset,
      customStylePrompt: body.customStylePrompt ?? null,
      voiceName: body.voiceCloneName,
      backgroundMusicId,
      musicVolume,
      styleId, // null is fine, falls back to stylePreset path
      status: scriptOverride ? "scripted" : "extracting_principles",
      progress: scriptOverride ? 30 : 35,
      errorMessage: null,
      ...(scriptOverride
        ? {
            script: scriptOverride,
            scriptMeta: {
              wordCount: overrideWordCount,
              targetWordCount,
              source: "user-supplied",
            },
          }
        : {}),
    },
  });

  // Kick off the run-creation pipeline on the DGX
  try {
    // Scene consistency: 0=independent (legacy), 70=recommended img2img chaining
    const consistency =
      typeof body.consistency === "number" && Number.isFinite(body.consistency)
        ? Math.max(0, Math.min(100, Math.round(body.consistency)))
        : 0;

    const validBackends = new Set([
      "sdxl", "veo-3.1-lite", "veo-3.0-fast", "veo-3.1-fast", "veo-3.0", "veo-3.1", "hybrid",
    ]);
    const videoBackend =
      typeof body.videoBackend === "string" && validBackends.has(body.videoBackend)
        ? body.videoBackend
        : "sdxl";

    // TubeGen-parity animation mode — folded into the styleSnapshot so the
    // DGX worker reads it from style_dict.defaultAnimMode. When user didn't
    // set a Style doc, we synthesise a minimal snapshot just to carry the
    // anim fields through — the DGX worker treats missing fields as defaults.
    const validAnimModes = new Set([
      "none",
      "all",
      "longer-only",
      "per-scene",
    ]);
    const validAnimQualities = new Set([
      "turbo",
      "default",
      "default_1080p",
      "high",
      "kling-standard",
      "kling-pro",
      "kling-master",
      "luma",
      "ltx-local",
    ]);
    const animMode =
      typeof body.animMode === "string" && validAnimModes.has(body.animMode)
        ? body.animMode
        : "none";
    const animQuality =
      typeof body.animQuality === "string" &&
      validAnimQualities.has(body.animQuality)
        ? body.animQuality
        : "default";

    // `animQuality` isn't on StyleSnapshot officially — DGX reads it from
    // style_dict by key, so we widen to a plain record before passing.
    const cloudRental = body.cloudRental === true;

    // When user opts into cloud rental, force the paid backends so the bill
    // matches what the cost panel quoted:
    //   - stills route → FireRed on Modal L40S (~$0.03/scene). Same model as
    //     the local DGX firered-local path so character consistency carries
    //     over identically; just runs on serverless GPU instead of GB10.
    //   - animation    → Modal L40S Wan2.2, unless user pre-picked a Modal
    //     tier (respect explicit choice).
    const effectiveAnimQuality =
      cloudRental && animMode !== "none" && !animQuality.startsWith("modal-")
        ? "modal-wan22"
        : animQuality;
    // Image renderer: explicit user pick wins over cloud-rental's auto-pick.
    const validImageQualities = new Set([
      "firered-local",
      "firered-modal",
      "firered-modal-fast",
      "gemini-1k",
      "gemini-2k",
      "ideogram-turbo",
      "ideogram-default",
      "ideogram-quality",
      "sdxl-local",
    ]);
    const userImageQuality =
      typeof body.imageQuality === "string" &&
      validImageQualities.has(body.imageQuality)
        ? body.imageQuality
        : null;
    const effectiveImageQuality =
      userImageQuality ?? (cloudRental ? "firered-modal" : undefined);

    const styleWithAnim: StyleSnapshot | undefined =
      animMode !== "none" || cloudRental || effectiveImageQuality
        ? ({
            ...(styleSnapshot ?? {}),
            ...(animMode !== "none"
              ? { defaultAnimMode: animMode, animQuality: effectiveAnimQuality }
              : {}),
            ...(effectiveImageQuality
              ? { defaultQuality: effectiveImageQuality }
              : {}),
            ...(cloudRental ? { cloudRental: true } : {}),
          } as unknown as StyleSnapshot)
        : styleSnapshot;

    // Topic-mode (own-script) kickoffs may have null transcript — autopilot
    // accepts undefined for that case. transcribe-mode always has one.
    const effectiveMode: "transcribe" | "topic" =
      scriptOverride && !project.transcript
        ? "topic"
        : ((project.mode as "transcribe" | "topic") || "transcribe");

    const job = await autopilot.runCreation({
      projectId: id,
      mode: effectiveMode,
      transcript: project.transcript ?? undefined,
      goal: effectiveGoal,
      targetWordCount,
      stylePreset,
      voiceCloneName: body.voiceCloneName,
      customStylePrompt: body.customStylePrompt,
      backgroundMusicId: backgroundMusicId ?? undefined,
      musicVolume,
      scriptGuidelines: body.scriptGuidelines,
      consistency,
      videoBackend: videoBackend as RunCreationInput["videoBackend"],
      style: styleWithAnim,
      ...(scriptOverride ? { scriptOverride } : {}),
    });

    const withJob = await prisma.youTubeProject.update({
      where: { id },
      data: { autopilotJobId: job.jobId },
    });
    return NextResponse.json({ project: withJob });
  } catch (err) {
    const detail =
      err instanceof AutopilotError
        ? `[${err.status}] ${err.body || err.message}`
        : err instanceof Error
          ? err.message
          : "unknown error";
    // Roll the project into failed so the UI surfaces the problem
    const failed = await prisma.youTubeProject.update({
      where: { id },
      data: {
        status: "failed",
        errorMessage: `run-creation kickoff failed: ${detail}`.slice(0, 1000),
      },
    });
    return NextResponse.json(
      { error: "run-creation kickoff failed", detail, project: failed },
      { status: 502 },
    );
  }
}
