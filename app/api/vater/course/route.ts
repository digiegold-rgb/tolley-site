/**
 * /api/vater/course — the financial-literacy course (production side).
 *
 * GET  → { course, lessons } for the Course Studio tab.
 * POST → idempotent seed: creates the Course + 25 CourseLesson rows from
 *        lib/vater/course-curriculum.ts. Existing lessons are left untouched
 *        (titles/descriptions may have been edited), missing ones are added.
 *
 * Studio-allowlist only — this is a production surface, not course delivery.
 */

import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isVaterStudioEmail } from "@/lib/admin-auth";
import {
  COURSE_SLUG,
  COURSE_TITLE,
  CURRICULUM,
} from "@/lib/vater/course-curriculum";

export const runtime = "nodejs";

async function requireStudioSession() {
  const session = await auth();
  if (!session?.user?.id || !isVaterStudioEmail(session.user.email)) {
    return null;
  }
  return session;
}

export async function GET() {
  const session = await requireStudioSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const course = await prisma.course.findUnique({
    where: { slug: COURSE_SLUG },
    include: { lessons: { orderBy: { order: "asc" } } },
  });
  if (!course) {
    return NextResponse.json({ course: null, lessons: [] });
  }
  const { lessons, ...rest } = course;
  return NextResponse.json({ course: rest, lessons });
}

export async function POST() {
  const session = await requireStudioSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const course = await prisma.course.upsert({
    where: { slug: COURSE_SLUG },
    create: { slug: COURSE_SLUG, title: COURSE_TITLE },
    update: {},
  });

  const existing = await prisma.courseLesson.findMany({
    where: { courseId: course.id },
    select: { order: true },
  });
  const have = new Set(existing.map((l) => l.order));
  const missing = CURRICULUM.filter((l) => !have.has(l.order));
  if (missing.length) {
    await prisma.courseLesson.createMany({
      data: missing.map((l) => ({
        courseId: course.id,
        order: l.order,
        title: l.title,
        description: l.description,
      })),
    });
  }

  return NextResponse.json({
    ok: true,
    courseId: course.id,
    created: missing.length,
    total: CURRICULUM.length,
  });
}
