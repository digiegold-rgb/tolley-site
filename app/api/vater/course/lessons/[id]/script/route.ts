/**
 * /api/vater/course/lessons/[id]/script
 *
 * POST — kick the DGX chaptered script generator for this lesson
 *        (status → script_requested). 409 if a script job is already live
 *        or the lesson is past the script stage (pass {force:true} to
 *        regenerate before approval).
 * GET  — poll the script job; on done persist scriptDocJson
 *        (status → script_ready) and return chapters + editor warnings.
 *
 * Studio-allowlist only. Nothing here renders anything — the render gate
 * is /approve.
 */

import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isVaterStudioEmail } from "@/lib/admin-auth";
import { autopilot, AutopilotError } from "@/lib/vater/autopilot-client";
import { CURRICULUM, SEGMENTS_PER_LESSON, CHAPTER_TARGET_WORDS } from "@/lib/vater/course-curriculum";
import { parseChapters, validateChapters } from "@/lib/vater/course-pipeline";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

async function loadLesson(id: string) {
  const session = await auth();
  if (!session?.user?.id || !isVaterStudioEmail(session.user.email)) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  const lesson = await prisma.courseLesson.findUnique({ where: { id } });
  if (!lesson) {
    return { error: NextResponse.json({ error: "Lesson not found" }, { status: 404 }) };
  }
  return { lesson, session };
}

export async function POST(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const got = await loadLesson(id);
  if ("error" in got) return got.error;
  const { lesson } = got;

  let force = false;
  try {
    const body = (await req.json()) as { force?: boolean };
    force = body?.force === true;
  } catch {
    // empty body is fine
  }

  const editable = ["planned", "script_requested", "script_ready", "failed"];
  if (!editable.includes(lesson.status) && !force) {
    return NextResponse.json(
      { error: `Lesson is ${lesson.status} — script can no longer be regenerated` },
      { status: 409 },
    );
  }
  if (lesson.status === "script_requested" && lesson.scriptJobId && !force) {
    return NextResponse.json(
      { error: "Script generation already in flight", jobId: lesson.scriptJobId },
      { status: 409 },
    );
  }

  const cur = CURRICULUM.find((l) => l.order === lesson.order);
  const { jobId } = await autopilot.courseScript({
    lessonId: lesson.id,
    order: lesson.order,
    title: lesson.title,
    description: lesson.description,
    module: cur?.module,
    prevTitle: CURRICULUM.find((l) => l.order === lesson.order - 1)?.title,
    nextTitle: CURRICULUM.find((l) => l.order === lesson.order + 1)?.title,
    chapters: SEGMENTS_PER_LESSON,
    chapterWords: CHAPTER_TARGET_WORDS,
  });

  const updated = await prisma.courseLesson.update({
    where: { id: lesson.id },
    data: { status: "script_requested", scriptJobId: jobId, errorMessage: null },
  });
  return NextResponse.json({ lesson: updated, jobId });
}

export async function GET(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const got = await loadLesson(id);
  if ("error" in got) return got.error;
  const { lesson } = got;

  if (lesson.status !== "script_requested" || !lesson.scriptJobId) {
    const chapters = parseChapters(lesson.scriptDocJson);
    return NextResponse.json({
      lesson,
      chapters,
      warnings: chapters ? validateChapters(chapters) : [],
    });
  }

  let job: { status?: string; phase?: string; progress?: number; error?: string; result?: unknown };
  try {
    job = await autopilot.getJob(lesson.scriptJobId);
  } catch (err) {
    if (err instanceof AutopilotError && err.status === 404) {
      const failed = await prisma.courseLesson.update({
        where: { id: lesson.id },
        data: {
          status: "failed",
          errorMessage: "Script job vanished from the DGX registry — request the script again",
        },
      });
      return NextResponse.json({ lesson: failed, chapters: null, warnings: [] });
    }
    throw err;
  }

  if (job.status === "failed" || job.status === "cancelled") {
    const failed = await prisma.courseLesson.update({
      where: { id: lesson.id },
      data: {
        status: "failed",
        errorMessage: `Script generation ${job.status}: ${job.error ?? "unknown error"}`,
      },
    });
    return NextResponse.json({ lesson: failed, chapters: null, warnings: [] });
  }

  if (job.status !== "done") {
    return NextResponse.json({
      lesson,
      chapters: null,
      warnings: [],
      job: { phase: job.phase, progress: job.progress },
    });
  }

  const result = (job.result ?? {}) as { chapters?: unknown; meta?: unknown };
  const doc = { chapters: result.chapters ?? [], meta: result.meta ?? {} };
  const chapters = parseChapters(doc);
  if (!chapters || chapters.length === 0) {
    const failed = await prisma.courseLesson.update({
      where: { id: lesson.id },
      data: { status: "failed", errorMessage: "Script job finished without chapters" },
    });
    return NextResponse.json({ lesson: failed, chapters: null, warnings: [] });
  }

  const updated = await prisma.courseLesson.update({
    where: { id: lesson.id },
    data: {
      status: "script_ready",
      scriptDocJson: doc as never,
      errorMessage: null,
    },
  });
  return NextResponse.json({
    lesson: updated,
    chapters,
    warnings: validateChapters(chapters),
  });
}
