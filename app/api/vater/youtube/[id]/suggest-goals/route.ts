/**
 * POST /api/vater/youtube/[id]/suggest-goals
 *
 * Re-runs the stateless LLM goal-suggestion step for a transcribed project.
 * Useful when the user wants fresh angle options without re-transcribing.
 *
 * Validation: project must exist and have a transcript.
 * No silent catches per feedback_silent_failures_leads.md.
 */
import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  autopilot,
  AutopilotError,
} from "@/lib/vater/autopilot-client";
import { auth } from "@/auth";
import { canAccessProject } from "@/lib/vater/project-access";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, ctx: Ctx) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;

  const project = await prisma.youTubeProject.findUnique({ where: { id } });
  if (
    !project ||
    !canAccessProject(project.userId, session.user.id, session.user.email)
  ) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  if (!project.transcript) {
    return NextResponse.json(
      { error: "Project has no transcript — transcribe the source first" },
      { status: 409 },
    );
  }

  let result: { suggestions: unknown[] };
  try {
    result = await autopilot.suggestGoals({
      transcript: project.transcript,
      title: project.sourceTitle ?? undefined,
      channel: project.sourceChannel ?? undefined,
    });
  } catch (err) {
    if (err instanceof AutopilotError) {
      console.error(
        `[vater/suggest-goals] project=${id} autopilot error: ${err.message}`,
      );
      return NextResponse.json(
        {
          error: "suggest-goals failed",
          detail: `[${err.status}] ${err.body || err.message}`,
        },
        { status: 502 },
      );
    }
    throw err;
  }

  const updated = await prisma.youTubeProject.update({
    where: { id },
    data: {
      goalSuggestions: result.suggestions as Prisma.InputJsonValue,
    },
  });

  console.log(
    `[vater/suggest-goals] project=${id} suggestions=${result.suggestions.length}`,
  );

  return NextResponse.json({ suggestions: result.suggestions, project: updated });
}
