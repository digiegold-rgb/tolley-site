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
} from "@/lib/vater/autopilot-client";
import {
  isStylePresetId,
  DEFAULT_STYLE_PRESET,
} from "@/lib/vater/style-presets";

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
}

export async function POST(req: NextRequest, ctx: Ctx) {
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
      status: "extracting_principles",
      progress: 35,
      errorMessage: null,
    },
  });

  // Kick off the run-creation pipeline on the DGX
  try {
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
