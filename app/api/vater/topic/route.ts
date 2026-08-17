/**
 * POST /api/vater/topic
 *
 * Topic-mode (tubegen-style) project creation. Skips fetch + transcribe
 * entirely — the autopilot pipeline writes an original script from the
 * topic prompt, then converges with transcribe-mode at TTS.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  autopilot,
  AutopilotError,
  type StyleSnapshot,
} from "@/lib/vater/autopilot-client";
import {
  isStylePresetId,
  DEFAULT_STYLE_PRESET,
} from "@/lib/vater/style-presets";
import { buildStyleSnapshot } from "@/lib/vater/style-snapshot";
import { auth } from "@/auth";
import { checkBudget } from "@/lib/vater/billing/check-budget";
import { ownerFieldsForSessionWithCap } from "@/lib/vater/owner-tier";
import {
  elevenLabsKeyMissing,
  ELEVENLABS_KEY_REQUIRED,
} from "@/lib/vater/elevenlabs-key-gate";

interface TopicBody {
  topic?: string;
  goal?: string;
  targetDuration?: number;
  targetWordCount?: number;
  stylePreset?: string;
  voiceCloneName?: string;
  customStylePrompt?: string;
  videoBackend?: string;
  styleId?: string | null;
  /** Pre-written script. When set, the worker uses it verbatim and skips
   *  principle extraction + script generation. No min length enforced. */
  scriptOverride?: string;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: TopicBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const scriptOverride =
    typeof body.scriptOverride === "string" && body.scriptOverride.trim()
      ? body.scriptOverride.trim()
      : null;

  // When a pre-written script is supplied, topic + goal become metadata-only
  // and we synthesize sensible defaults if the user left them blank. Without
  // an override we keep the original strict validation.
  if (!scriptOverride) {
    if (!body.topic || typeof body.topic !== "string") {
      return NextResponse.json({ error: "topic is required" }, { status: 400 });
    }
    if (!body.goal || typeof body.goal !== "string") {
      return NextResponse.json({ error: "goal is required" }, { status: 400 });
    }
  }
  if (!body.voiceCloneName || typeof body.voiceCloneName !== "string") {
    return NextResponse.json(
      { error: "voiceCloneName is required" },
      { status: 400 },
    );
  }

  const effectiveTopic =
    typeof body.topic === "string" && body.topic.trim()
      ? body.topic.trim()
      : scriptOverride
        ? scriptOverride.slice(0, 80)
        : "";
  const effectiveGoal =
    typeof body.goal === "string" && body.goal.trim()
      ? body.goal.trim()
      : "User-supplied script";

  const overrideWordCount = scriptOverride
    ? scriptOverride.split(/\s+/).filter(Boolean).length
    : 0;

  const targetDuration =
    typeof body.targetDuration === "number" && body.targetDuration > 0
      ? Math.min(30, Math.max(1, Math.round(body.targetDuration)))
      : 10;
  const targetWordCount = scriptOverride
    ? Math.max(1, overrideWordCount)
    : typeof body.targetWordCount === "number" && body.targetWordCount > 0
      ? Math.round(body.targetWordCount)
      : targetDuration * 150;
  const stylePreset =
    body.stylePreset && isStylePresetId(body.stylePreset)
      ? body.stylePreset
      : DEFAULT_STYLE_PRESET;

  // Phase 1+: opt-in YouTubeStyle. When set, load the row and build a
  // snapshot; the snapshot rides inline in the runCreation payload.
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
    if (style.userId && style.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    styleSnapshot = buildStyleSnapshot(style);
  }

  // Budget gate (2026-08-15) — same check as /approve-script and /context.
  // Topic mode went straight to runCreation, so a trial-capped or
  // past-due account could render a full video for free through this door.
  // Checked BEFORE the project row is created so a 402 leaves no orphan.
  const budget = await checkBudget(session.user.id, "scene");
  if (!budget.allow) {
    return NextResponse.json(
      { error: "Billing check failed", budget },
      { status: 402 },
    );
  }

  const project = await prisma.youTubeProject.create({
    data: {
      userId: session.user.id,
      mode: "topic",
      sourceType: "topic",
      topic: effectiveTopic,
      goal: effectiveGoal,
      targetDuration,
      targetWordCount,
      stylePreset,
      voiceName: body.voiceCloneName,
      styleId,
      status: scriptOverride ? "scripted" : "extracting_principles",
      progress: 30,
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

  // ElevenLabs is bring-your-own-key (2026-08-17): refuse before the render
  // spends anything, not at the TTS step after the images are paid for.
  if (
    styleSnapshot?.voiceBackend === "elevenlabs" &&
    (await elevenLabsKeyMissing(project.userId ?? session.user.id))
  ) {
    return NextResponse.json(
      { error: ELEVENLABS_KEY_REQUIRED, code: "ELEVENLABS_KEY_REQUIRED" },
      { status: 400 },
    );
  }

  try {
    const validBackends = new Set([
      "sdxl", "veo-3.1-lite", "veo-3.0-fast", "veo-3.1-fast", "veo-3.0", "veo-3.1", "hybrid",
    ]);
    const videoBackend =
      typeof body.videoBackend === "string" && validBackends.has(body.videoBackend)
        ? body.videoBackend
        : "sdxl";

    const job = await autopilot.runCreation({
      projectId: project.id,
      mode: "topic",
      topic: effectiveTopic,
      goal: effectiveGoal,
      targetWordCount,
      stylePreset,
      voiceCloneName: body.voiceCloneName,
      videoBackend: videoBackend as "sdxl" | "veo-3.0-fast" | "veo-3.0" | "veo-3.1" | "hybrid",
      style: styleSnapshot,
      // Per-tenant fairness + script cap (content-autopilot 9cbe9a6). The
      // cap is the account's real one, not the beta floor — see script-cap.ts.
      ...(await ownerFieldsForSessionWithCap(session, project.userId)),
      ...(scriptOverride ? { scriptOverride } : {}),
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
