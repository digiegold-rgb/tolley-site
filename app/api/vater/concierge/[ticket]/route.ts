/**
 * GET /api/vater/concierge/[ticket]
 *
 * The authoritative ticket, fetched by code ("F5-XXXXXX") or project id.
 * This is what `/fable5 show` and the /hq "Copy pack" button read — `pack`
 * is built by `buildPackText` so both surfaces agree byte-for-byte.
 *
 * Auth: Bearer CONTENT_API_KEY or the /hq PIN cookie.
 *
 * → {ticket, owner:{userId,email,name,tier,lane,unmetered,balanceUsd,maxWords},
 *    projectOwnerId, project:{id,title,script,words,styleId,styleName,
 *    voiceName,voiceBackend,targetDuration,animUntilS,features,autopilotJobId,
 *    status,errorMessage,stepDetails,finalVideoUrl,costTotalUsd,costJson,
 *    audioUrl,audioDuration,sceneCount,updatedAt}, estimate:{usd,minutes,words},
 *    pack}
 */
import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { authorizeConcierge } from "@/lib/vater/concierge-auth";
import { buildPackText, wordCount } from "@/lib/vater/concierge";
import {
  costTotalUsd,
  dgxPhaseOf,
  loadTicketProject,
  projectTitle,
  resolveOwner,
} from "@/lib/vater/concierge-operator";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

type Ctx = { params: Promise<{ ticket: string }> };

function featuresOf(settingsJson: unknown): Record<string, unknown> {
  if (!settingsJson || typeof settingsJson !== "object" || Array.isArray(settingsJson)) return {};
  const { engine: _e, concierge: _c, ...rest } = settingsJson as Record<string, unknown>;
  void _e;
  void _c;
  return rest;
}

export async function GET(req: NextRequest, ctx: Ctx) {
  const auth = await authorizeConcierge(req);
  if (!auth.ok) return auth.response;

  const { ticket: param } = await ctx.params;
  const loaded = await loadTicketProject(param);
  if ("response" in loaded) return loaded.response;
  const { project, ticket } = loaded;

  const [owner, style] = await Promise.all([
    resolveOwner(project.userId),
    project.styleId
      ? prisma.youTubeStyle.findUnique({
          where: { id: project.styleId },
          select: { id: true, name: true, voice: true, voiceBackend: true },
        })
      : Promise.resolve(null),
  ]);

  // Same voice resolution as script-gate / buildPackText: a project-level
  // override is a local clone and drops ElevenLabs routing.
  const projectVoiceOverride = !!project.voiceName && project.voiceName !== style?.voice;
  const voiceName = project.voiceName || style?.voice || null;
  const voiceBackend = projectVoiceOverride
    ? style?.voiceBackend === "elevenlabs"
      ? "indextts-modal"
      : style?.voiceBackend ?? "local"
    : style?.voiceBackend ?? null;

  const pack = await buildPackText(
    { ...project, style: style ?? null },
    { userId: owner.userId, email: owner.email, lane: owner.lane, tier: owner.tier },
  );

  const script = project.script ?? "";
  const words = ticket.words || wordCount(script);

  return NextResponse.json({
    ticket,
    owner,
    projectOwnerId: project.userId,
    project: {
      id: project.id,
      title: projectTitle(project),
      script,
      words,
      styleId: project.styleId,
      styleName: style?.name ?? null,
      voiceName,
      voiceBackend,
      targetDuration: project.targetDuration,
      animUntilS: project.animUntilS,
      features: featuresOf(project.settingsJson),
      autopilotJobId: project.autopilotJobId,
      status: project.status,
      errorMessage: project.errorMessage,
      stepDetails: project.stepDetails,
      dgxPhase: dgxPhaseOf(project.stepDetails),
      finalVideoUrl: project.finalVideoUrl,
      costTotalUsd: costTotalUsd(project.costJson),
      costJson: project.costJson,
      audioUrl: project.audioUrl,
      audioDuration: project.audioDuration,
      sceneCount: Array.isArray(project.scenesJson) ? project.scenesJson.length : 0,
      updatedAt: project.updatedAt.toISOString(),
    },
    estimate: { usd: ticket.estimateUsd, minutes: ticket.estMinutes, words },
    pack,
  });
}
