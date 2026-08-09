/**
 * /api/vater/course/lessons/[id]/approve — THE human render gate.
 *
 * POST body: { chapters: [{idx, title, text}] } — the edited chapter texts
 * from the tab. Persists them + scriptApprovedAt, creates the segment
 * YouTubeProject rows, and kicks segment 1. Nothing in the course lane
 * renders without this click (NO-autonomous-sends doctrine: the human
 * pulls the trigger).
 *
 * Studio-allowlist only; budget-gated like the YouTube approve route.
 */

import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isVaterStudioEmail } from "@/lib/admin-auth";
import { checkBudget } from "@/lib/vater/billing/check-budget";
import {
  advanceLessonChain,
  createSegmentProjects,
  parseChapters,
  validateChapters,
  type CourseChapter,
} from "@/lib/vater/course-pipeline";

export const runtime = "nodejs";
export const maxDuration = 120;

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const session = await auth();
  if (!session?.user?.id || !isVaterStudioEmail(session.user.email)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const lesson = await prisma.courseLesson.findUnique({ where: { id } });
  if (!lesson) {
    return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
  }
  if (!["script_ready", "failed"].includes(lesson.status)) {
    return NextResponse.json(
      { error: `Lesson is ${lesson.status} — approve requires script_ready` },
      { status: 409 },
    );
  }
  if (lesson.status === "failed" && lesson.segmentsJson) {
    return NextResponse.json(
      { error: "This lesson already has segments — use Resume instead of re-approving" },
      { status: 409 },
    );
  }

  let body: { chapters?: Array<{ idx?: number; title?: string; text?: string }> };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const doc = { chapters: body.chapters ?? [], meta: { approvedBy: session.user.email } };
  const chapters: CourseChapter[] | null = parseChapters(doc);
  if (!chapters || chapters.length < 2) {
    return NextResponse.json(
      { error: "chapters[] with idx + text required (at least 2)" },
      { status: 400 },
    );
  }

  // Same budget gate as the YouTube approve route (unmetered for studio).
  const budget = await checkBudget(session.user.id, "scene");
  if (!budget.allow) {
    return NextResponse.json(
      { error: "Billing check failed", budget },
      { status: 402 },
    );
  }

  const segments = await createSegmentProjects(lesson, chapters, session.user.id);
  await prisma.courseLesson.update({
    where: { id: lesson.id },
    data: {
      status: "rendering",
      scriptDocJson: doc as never,
      scriptApprovedAt: new Date(),
      segmentsJson: segments as never,
      currentSegment: 0,
      concatJobId: null,
      finalVideoUrl: null,
      errorMessage: null,
    },
  });

  // First tick kicks segment 1 immediately.
  const updated = await advanceLessonChain(lesson.id);
  return NextResponse.json({
    lesson: updated,
    warnings: validateChapters(chapters),
  });
}
