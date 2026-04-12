/**
 * POST /api/vater/topic
 *
 * Topic-mode (tubegen-style) project creation. Skips fetch + transcribe
 * entirely — the autopilot pipeline writes an original script from the
 * topic prompt, then converges with transcribe-mode at TTS.
 *
 * Body: {
 *   topic: string,
 *   goal: string,
 *   targetDuration: number,         // minutes
 *   targetWordCount?: number,       // overrides duration*150 if given
 *   stylePreset: string,
 *   voiceCloneName: string,
 *   customStylePrompt?: string,
 * }
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

interface TopicBody {
  topic?: string;
  goal?: string;
  targetDuration?: number;
  targetWordCount?: number;
  stylePreset?: string;
  voiceCloneName?: string;
  customStylePrompt?: string;
}

export async function POST(req: NextRequest) {
  let body: TopicBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.topic || typeof body.topic !== "string") {
    return NextResponse.json({ error: "topic is required" }, { status: 400 });
  }
  if (!body.goal || typeof body.goal !== "string") {
    return NextResponse.json({ error: "goal is required" }, { status: 400 });
  }
  if (!body.voiceCloneName || typeof body.voiceCloneName !== "string") {
    return NextResponse.json(
      { error: "voiceCloneName is required" },
      { status: 400 },
    );
  }

  const targetDuration =
    typeof body.targetDuration === "number" && body.targetDuration > 0
      ? Math.min(30, Math.max(1, Math.round(body.targetDuration)))
      : 10;
  const targetWordCount =
    typeof body.targetWordCount === "number" && body.targetWordCount > 0
      ? Math.round(body.targetWordCount)
      : targetDuration * 150;
  const stylePreset =
    body.stylePreset && isStylePresetId(body.stylePreset)
      ? body.stylePreset
      : DEFAULT_STYLE_PRESET;

  const project = await prisma.youTubeProject.create({
    data: {
      mode: "topic",
      sourceType: "topic",
      topic: body.topic,
      goal: body.goal,
      targetDuration,
      targetWordCount,
      stylePreset,
      customStylePrompt: body.customStylePrompt ?? null,
      voiceName: body.voiceCloneName,
      status: "extracting_principles",
      progress: 30,
    },
  });

  try {
    const job = await autopilot.runCreation({
      projectId: project.id,
      mode: "topic",
      topic: body.topic,
      goal: body.goal,
      targetWordCount,
      stylePreset,
      voiceCloneName: body.voiceCloneName,
      customStylePrompt: body.customStylePrompt,
    });

    const withJob = await prisma.youTubeProject.update({
      where: { id: project.id },
      data: { autopilotJobId: job.jobId },
    });

    return NextResponse.json({ project: withJob }, { status: 201 });
  } catch (err) {
    const detail =
      err instanceof AutopilotError
        ? `[${err.status}] ${err.body || err.message}`
        : err instanceof Error
          ? err.message
          : "unknown error";
    const failed = await prisma.youTubeProject.update({
      where: { id: project.id },
      data: {
        status: "failed",
        errorMessage: `topic-mode kickoff failed: ${detail}`.slice(0, 1000),
      },
    });
    return NextResponse.json(
      { error: "topic-mode kickoff failed", detail, project: failed },
      { status: 502 },
    );
  }
}
