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
  /** Phase 1+: opt-in YouTubeStyle id. When present, style snapshot
   *  takes precedence over stylePreset for fields it sets. */
  styleId?: string | null;
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

  if (!body.goal || typeof body.goal !== "string") {
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
  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (project.status !== "transcribed") {
    return NextResponse.json(
      {
        error: `Project must be in 'transcribed' status to submit context, currently '${project.status}'`,
      },
      { status: 409 },
    );
  }
  if (!project.transcript) {
    return NextResponse.json(
      { error: "Project has no transcript yet" },
      { status: 409 },
    );
  }

  const targetDuration =
    typeof body.targetDuration === "number" && body.targetDuration > 0
      ? Math.min(30, Math.max(1, Math.round(body.targetDuration)))
      : project.targetDuration || 10;

  const targetWordCount =
    typeof body.targetWordCount === "number" && body.targetWordCount > 0
      ? Math.round(body.targetWordCount)
      : targetDuration * 150;

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
  // autopilot call fails.
  const updated = await prisma.youTubeProject.update({
    where: { id },
    data: {
      goal: body.goal,
      targetDuration,
      targetWordCount,
      stylePreset,
      customStylePrompt: body.customStylePrompt ?? null,
      voiceName: body.voiceCloneName,
      backgroundMusicId,
      musicVolume,
      styleId, // null is fine, falls back to stylePreset path
      status: "extracting_principles",
      progress: 35,
      errorMessage: null,
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

    const job = await autopilot.runCreation({
      projectId: id,
      mode: (project.mode as "transcribe" | "topic") || "transcribe",
      transcript: project.transcript,
      goal: body.goal,
      targetWordCount,
      stylePreset,
      voiceCloneName: body.voiceCloneName,
      customStylePrompt: body.customStylePrompt,
      backgroundMusicId: backgroundMusicId ?? undefined,
      musicVolume,
      scriptGuidelines: body.scriptGuidelines,
      consistency,
      videoBackend: videoBackend as RunCreationInput["videoBackend"],
      style: styleSnapshot,
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
