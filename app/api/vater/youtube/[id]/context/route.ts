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
import {
  IN_FLIGHT_STATUSES,
  STATUS_LABELS,
  type YouTubeProjectStatus,
} from "@/lib/vater/youtube-status";
import { buildStyleSnapshot } from "@/lib/vater/style-snapshot";
import { auth } from "@/auth";
import { canAccessProject } from "@/lib/vater/project-access";
import { isVaterAdminEmail, isVaterStudioEmail } from "@/lib/admin-auth";
import { canUseCreatorModel } from "@/lib/vater/creator-models";
import { ownerFieldsForSessionWithCap } from "@/lib/vater/owner-tier";
import {
  elevenLabsKeyMissing,
  ELEVENLABS_KEY_REQUIRED,
} from "@/lib/vater/elevenlabs-key-gate";
import { checkBudget } from "@/lib/vater/billing/check-budget";
import { maxWordsFor } from "@/lib/vater/billing/script-cap";
import {
  isBetaLengthRejection,
  isOverLength,
  lengthMessageFor,
  runtimeClock,
} from "@/lib/vater/script-limits";

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
  /** Script-review gate: stop the worker after the script is written so a
   *  human can edit + approve it before any generation spend. The render is
   *  kicked later by /approve-script with the approved text as scriptOverride. */
  stopAfterScript?: boolean;
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

  const project = await prisma.youTubeProject.findUnique({ where: { id } });
  if (
    !project ||
    !canAccessProject(project.userId, session.user.id, session.user.email)
  ) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  // ── Goal + voice resolution (2026-08-17) ─────────────────────────────
  // This endpoint is BOTH "kick the pipeline" and "save a setting" — the
  // Soundtrack, Visuals and Voiceover steps all POST here with only their
  // own field. Requiring the caller to restate goal + voice every time meant
  // four of the seven editor steps 400'd with "goal is required" on the very
  // first click. Fall back to what the project already knows (and, failing
  // that, to its Style) so a partial POST is a valid POST.
  const projectGoal =
    typeof body.goal === "string" && body.goal.trim()
      ? body.goal.trim()
      : project.goal?.trim() ||
        project.sourceTitle?.trim() ||
        project.topic?.trim() ||
        "";

  let resolvedVoice =
    typeof body.voiceCloneName === "string" && body.voiceCloneName.trim()
      ? body.voiceCloneName.trim()
      : project.voiceName?.trim() || "";

  // Legacy projects created before the Style→project voice copy landed have
  // voiceName=null; read it off the attached Style rather than 400-ing.
  if (!resolvedVoice && project.styleId) {
    const styleVoice = await prisma.youTubeStyle.findUnique({
      where: { id: project.styleId },
      select: { voice: true },
    });
    resolvedVoice = styleVoice?.voice?.trim() || "";
  }

  if (!resolvedVoice) {
    return NextResponse.json(
      {
        error:
          "This project has no voice yet — pick one in the Voiceover step (or attach a Style that has one) before generating.",
      },
      { status: 400 },
    );
  }

  // The DGX writes the script from the goal. A user-supplied script makes it
  // optional metadata; without one it is the only brief the writer gets.
  if (!scriptOverride && !projectGoal) {
    return NextResponse.json(
      {
        error:
          "This project has no title or goal yet — commit a title in the Title step before generating a script.",
      },
      { status: 400 },
    );
  }

  // ── Billing gate: run-creation generates the scene plan + images. The
  // exact scene count isn't knowable at kickoff, so gate at one scene image
  // (25¢, action "scene"). The actual charges (script + voiceover + per-scene
  // images) are recorded by the poll route once the job is confirmed done,
  // idempotent per jobId — kickoff never bills.
  // Creator models are tier-gated (studio-only models are private channel
  // DNA). Reject ids the caller cannot see so the browse gate can't be
  // bypassed by POSTing the id directly.
  if (body.creatorModelId) {
    const email = session.user.email;
    const callerTier = isVaterAdminEmail(email)
      ? "owner"
      : isVaterStudioEmail(email)
        ? "studio"
        : "public";
    if (!canUseCreatorModel(body.creatorModelId, callerTier)) {
      return NextResponse.json(
        { error: "creator model not available on your plan" },
        { status: 403 },
      );
    }
  }

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
  //
  // Topic mode is the v2 default: a project started from a Style card has no
  // transcript and never will — the DGX writes the script from the goal. Only
  // transcribe-mode projects (started from a YouTube URL) need a transcript
  // before context can be submitted.
  const isTopicMode = project.mode === "topic";
  const allowKickoffFromDraft =
    (!!scriptOverride || isTopicMode) &&
    (project.status === "draft" ||
      project.status === "scripted" ||
      // A stopAfterScript run parks here with the draft persisted — the
      // Generate Video button IS the approval, same as /approve-script.
      project.status === "awaiting_script_approval" ||
      project.status === "failed");
  if (project.status !== "transcribed" && !allowKickoffFromDraft) {
    // A pipeline status here means a render is ALREADY running — say that in
    // plain words instead of leaking status-machine jargon ("must be
    // transcribed … currently generating_audio" confused every beta tester).
    const inFlight = IN_FLIGHT_STATUSES.has(
      project.status as YouTubeProjectStatus,
    );
    return NextResponse.json(
      {
        error: inFlight
          ? `A render is already in progress on this project (${STATUS_LABELS[project.status as YouTubeProjectStatus] ?? project.status}). Watch it in the Queue — or cancel it there — before starting another.`
          : `This project isn't ready to render yet (status: ${project.status}). Finish the earlier steps first.`,
      },
      { status: 409 },
    );
  }
  if (!scriptOverride && !isTopicMode && !project.transcript) {
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

  // Runtime cap. The DGX rejects an over-cap `scriptOverride` too, but its 400
  // lands after the project row has been flipped to "scripted" — catching it
  // here keeps the project clean and the message ours.
  //
  // Tier-aware (lib/vater/billing/script-cap.ts): owner uncapped, purchased
  // balance ~20:00, otherwise ~9:00. `ownerFieldsForSessionWithCap` below
  // carries the SAME number to the DGX, so the two can't disagree.
  const sessionMaxWords = await maxWordsFor(session.user.id, session.user.email);
  if (scriptOverride && isOverLength(overrideWordCount, sessionMaxWords)) {
    const message = lengthMessageFor(sessionMaxWords);
    return NextResponse.json(
      {
        error: "script_too_long",
        message,
        detail: `That script is ${overrideWordCount.toLocaleString()} words (≈ ${runtimeClock(overrideWordCount)}). ${message}`,
        wordCount: overrideWordCount,
        maxWords: sessionMaxWords,
      },
      { status: 400 },
    );
  }

  const effectiveGoal = projectGoal || "User-supplied script";

  // Fall back to the preset already seeded on the project (from its Style)
  // before the global default — a "Classic Cartoon" project must never
  // silently render cinematic just because the caller omitted the field.
  const stylePreset =
    body.stylePreset && isStylePresetId(body.stylePreset)
      ? body.stylePreset
      : project.stylePreset && isStylePresetId(project.stylePreset)
        ? project.stylePreset
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
  //
  // 2026-08-17: fall back to the project's OWN styleId when the caller
  // omits the key. ScriptStep never sent one, so a customer who picked
  // "Cinematic" got a kickoff with no snapshot at all — and the DGX filled
  // the hole with the standing spec, rendering their video in Vater's house
  // art style with Vater's house host. An explicit `styleId: null` still
  // means "legacy preset path", so nothing that used to opt out changes.
  const styleId =
    typeof body.styleId === "string" && body.styleId.trim()
      ? body.styleId.trim()
      : body.styleId === null
        ? null
        : project.styleId;

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
      voiceName: resolvedVoice,
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
    // Animation NEVER runs on the DGX GPU for anyone (2026-08-26): any
    // *-local tier collapses to the calm Modal default. Cloud-rental
    // (default since the "DGX Local" card was removed) also pins non-Modal
    // picks to Modal so the bill matches the quote.
    const effectiveAnimQuality =
      animMode !== "none" && /-local$/.test(animQuality)
        ? "modal-wan22-narrative"
        : cloudRental && animMode !== "none" && !animQuality.startsWith("modal-")
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

    // ── Modal-only for non-owners (vater-modal-only-never-local-gpu) ──────
    // A customer render must never occupy the DGX GB10. The owner keeps the
    // local lane (that's the whole point of owning the box); everyone else is
    // pinned to the serverless backends no matter what they asked for.
    //   images: any *-local renderer → firered-modal
    //   voice:  the local F5-TTS lane → indextts-modal. ElevenLabs is left
    //           alone — it's already cloud, and rewriting it would hand an
    //           EL voice_id to IndexTTS and 404 the render at the TTS step.
    const isOwner = isVaterAdminEmail(session.user.email);
    const isLocalImageBackend = (q: string | undefined) =>
      !q || q.endsWith("-local") || q === "sdxl-ipadapter";
    const forcedImageQuality =
      isOwner || !isLocalImageBackend(effectiveImageQuality)
        ? effectiveImageQuality
        : "firered-modal";
    const forceModalVoice =
      !isOwner && styleSnapshot?.voiceBackend !== "elevenlabs";

    // ── ElevenLabs is bring-your-own-key (2026-08-17) ────────────────────
    // Ask before spending: without a connected key the DGX refuses at the
    // TTS step, which is after the script and images have been paid for.
    if (styleSnapshot?.voiceBackend === "elevenlabs") {
      const ownerIdForKey = project.userId ?? session.user.id;
      if (await elevenLabsKeyMissing(ownerIdForKey)) {
        return NextResponse.json(
          { error: ELEVENLABS_KEY_REQUIRED, code: "ELEVENLABS_KEY_REQUIRED" },
          { status: 400 },
        );
      }
    }

    // Hybrid render window — animate the first N seconds, Ken Burns the rest.
    // Lives on the project row (set from the Script Review intake form) and
    // rides to the DGX inside the style snapshot as `defaultAnimUntilS`.
    const animUntilS =
      typeof project.animUntilS === "number" && project.animUntilS > 0
        ? project.animUntilS
        : null;

    const styleWithAnim: StyleSnapshot | undefined =
      animMode !== "none" ||
      cloudRental ||
      forcedImageQuality ||
      animUntilS ||
      forceModalVoice
        ? ({
            ...(styleSnapshot ?? {}),
            ...(animMode !== "none"
              ? { defaultAnimMode: animMode, animQuality: effectiveAnimQuality }
              : {}),
            ...(animUntilS ? { defaultAnimUntilS: animUntilS } : {}),
            ...(forcedImageQuality
              ? { defaultQuality: forcedImageQuality }
              : {}),
            ...(forceModalVoice ? { voiceBackend: "indextts-modal" } : {}),
            ...(cloudRental ? { cloudRental: true } : {}),
          } as unknown as StyleSnapshot)
        : styleSnapshot;

    // Topic-mode (own-script) kickoffs may have null transcript — autopilot
    // accepts undefined for that case. transcribe-mode always has one.
    const effectiveMode: "transcribe" | "topic" =
      scriptOverride && !project.transcript
        ? "topic"
        : ((project.mode as "transcribe" | "topic") || "transcribe");

    // The DGX rejects topic mode without a `topic` ("topic required in topic
    // mode"). We never sent one — which is why EVERY v2 render died at
    // kickoff. The topic is the brief: the committed title, else the goal.
    const effectiveTopic =
      project.topic?.trim() ||
      project.sourceTitle?.trim() ||
      effectiveGoal.trim() ||
      undefined;
    if (effectiveMode === "topic" && !effectiveTopic) {
      return NextResponse.json(
        {
          error:
            "This project has no title or goal yet — commit a title in the Title step before generating.",
        },
        { status: 400 },
      );
    }

    const job = await autopilot.runCreation({
      projectId: id,
      mode: effectiveMode,
      topic: effectiveTopic,
      transcript: project.transcript ?? undefined,
      goal: effectiveGoal,
      targetWordCount,
      stylePreset,
      voiceCloneName: resolvedVoice,
      customStylePrompt: body.customStylePrompt,
      backgroundMusicId: backgroundMusicId ?? undefined,
      musicVolume,
      scriptGuidelines: body.scriptGuidelines,
      consistency,
      videoBackend: videoBackend as RunCreationInput["videoBackend"],
      style: styleWithAnim,
      // Per-tenant fairness + script cap (content-autopilot 9cbe9a6). The
      // cap is the account's real one, not the beta floor — see script-cap.ts.
      ...(await ownerFieldsForSessionWithCap(session, project.userId)),
      ...(scriptOverride ? { scriptOverride } : {}),
      ...(body.stopAfterScript === true ? { stopAfterScript: true } : {}),
      // Optional feature bag (jelly-feature-contract 2026-08-16). Sent
      // verbatim: the worker ignores keys it doesn't implement, and a NULL
      // column means the key is simply absent — i.e. today's behavior.
      ...(updated.settingsJson &&
      typeof updated.settingsJson === "object" &&
      !Array.isArray(updated.settingsJson)
        ? { features: updated.settingsJson as Record<string, unknown> }
        : {}),
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

    // The DGX enforces the same 9:00 cap and words it differently. Surface our
    // sentence instead of the raw upstream string — but still mark the project
    // failed, because the row was flipped to "scripted" above and no job exists.
    if (
      err instanceof AutopilotError &&
      err.status === 400 &&
      isBetaLengthRejection(err.body)
    ) {
      const message = lengthMessageFor(sessionMaxWords);
      const overLong = await prisma.youTubeProject.update({
        where: { id },
        data: { status: "failed", errorMessage: message },
      });
      return NextResponse.json(
        {
          error: "script_too_long",
          message,
          detail: message,
          maxWords: sessionMaxWords,
          project: overLong,
        },
        { status: 400 },
      );
    }

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
