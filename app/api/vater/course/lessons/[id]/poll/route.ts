/**
 * /api/vater/course/lessons/[id]/poll — drives the segment render chain.
 *
 * GET — one chain tick: checks the current segment's DGX job, persists a
 *       finished segment (media + cost rollup), kicks the next one, kicks
 *       the concat after the last, and marks the lesson ready when the
 *       master lands. Orchestration is poll-driven — if nobody polls, the
 *       chain pauses at the current boundary (Resume picks it up).
 * POST {action:"resume"} — restart a stalled/failed chain at the first
 *       non-ready segment, or re-kick the concat.
 *
 * Studio-allowlist only.
 */

import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isVaterStudioEmail } from "@/lib/admin-auth";
import { AutopilotConfigError, AutopilotError } from "@/lib/vater/autopilot-client";
import { advanceLessonChain, resumeLessonChain } from "@/lib/vater/course-pipeline";

export const runtime = "nodejs";
export const maxDuration = 120;

type Ctx = { params: Promise<{ id: string }> };

async function guard() {
  const session = await auth();
  if (!session?.user?.id || !isVaterStudioEmail(session.user.email)) {
    return null;
  }
  return session;
}

function mapError(err: unknown) {
  if (err instanceof AutopilotConfigError) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
  if (err instanceof AutopilotError) {
    return NextResponse.json(
      { error: `DGX error: ${err.message}` },
      { status: 502 },
    );
  }
  throw err;
}

export async function GET(_req: Request, ctx: Ctx) {
  if (!(await guard())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const exists = await prisma.courseLesson.findUnique({ where: { id }, select: { id: true } });
  if (!exists) {
    return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
  }
  try {
    const lesson = await advanceLessonChain(id);
    return NextResponse.json({ lesson });
  } catch (err) {
    return mapError(err);
  }
}

export async function POST(req: Request, ctx: Ctx) {
  if (!(await guard())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  let action = "";
  try {
    action = String(((await req.json()) as { action?: string })?.action ?? "");
  } catch {
    // fall through — 400 below
  }
  if (action !== "resume") {
    return NextResponse.json({ error: 'action must be "resume"' }, { status: 400 });
  }
  const exists = await prisma.courseLesson.findUnique({ where: { id }, select: { id: true } });
  if (!exists) {
    return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
  }
  try {
    const lesson = await resumeLessonChain(id);
    return NextResponse.json({ lesson });
  } catch (err) {
    return mapError(err);
  }
}
