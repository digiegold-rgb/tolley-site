/**
 * lib/vater/course-pipeline.ts
 *
 * Segmented render chain for the financial-literacy course. A ~25-min
 * lesson can't render as one job (120-scene cap, unchunked TTS with a
 * 30-min ceiling), so each lesson runs as SEGMENTS_PER_LESSON sequential
 * run-creation jobs — one per approved script chapter — then a DGX concat
 * job stitches the masters. Segments are ordinary YouTubeProject rows
 * (projectType "course-segment") so startRunCreation, the scene proxies,
 * and mergeVideoCost work unmodified; the YouTube Library filters them out.
 *
 * Billing: course renders bill through the at-cost surface (DGX cost
 * capture → costJson rollup + ledger + ops fee). No retail VaterUsage
 * metering here — the course owner is an unmetered studio user, and
 * retail per-scene pricing would misprice ~300 scenes/lesson.
 *
 * Orchestration is poll-driven (the tab polls /api/vater/course/lessons/
 * [id]/poll which calls advanceLessonChain). Durable state lives on the
 * CourseLesson row — vater_jobs.json evicts finished jobs.
 */
import "server-only";

import type { CourseLesson, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { autopilot, AutopilotError } from "./autopilot-client";
import { startRunCreation } from "./script-gate";
import { mergeVideoCost, parseVideoCost } from "./video-cost";
import {
  CHAPTER_TARGET_WORDS,
  CHAPTER_WORDS_TOLERANCE,
  SEGMENT_ANIM_UNTIL_S,
  SEGMENT_TARGET_MINUTES,
  getCourseStyleId,
} from "./course-curriculum";

export interface CourseChapter {
  idx: number;
  title: string;
  text: string;
  wordCount: number;
  summaryLine?: string;
  qaIssues?: string[];
}

export interface SegmentEntry {
  idx: number;
  projectId: string;
  jobId?: string | null;
  status: "pending" | "rendering" | "ready" | "failed";
  videoUrl?: string | null;
  durationS?: number | null;
  phase?: string | null;
  progress?: number | null;
}

const countWords = (t: string) => t.split(/\s+/).filter(Boolean).length;

/** Parse scriptDocJson into chapters, or null if malformed. */
export function parseChapters(raw: unknown): CourseChapter[] | null {
  const doc = raw as { chapters?: unknown } | null;
  if (!doc || !Array.isArray(doc.chapters) || doc.chapters.length === 0) return null;
  const out: CourseChapter[] = [];
  for (const c of doc.chapters as Array<Record<string, unknown>>) {
    const text = typeof c?.text === "string" ? c.text.trim() : "";
    if (!text) return null;
    out.push({
      idx: Number(c.idx ?? out.length + 1),
      title: typeof c.title === "string" ? c.title : `Chapter ${out.length + 1}`,
      text,
      wordCount: countWords(text),
      summaryLine: typeof c.summaryLine === "string" ? c.summaryLine : undefined,
      qaIssues: Array.isArray(c.qaIssues) ? (c.qaIssues as string[]) : undefined,
    });
  }
  return out.sort((a, b) => a.idx - b.idx);
}

/** Editor-facing sanity report. Warnings, not blockers — the human decides. */
export function validateChapters(chapters: CourseChapter[]): string[] {
  const problems: string[] = [];
  const lo = Math.round(CHAPTER_TARGET_WORDS * (1 - CHAPTER_WORDS_TOLERANCE));
  const hi = Math.round(CHAPTER_TARGET_WORDS * (1 + CHAPTER_WORDS_TOLERANCE));
  for (const c of chapters) {
    if (c.wordCount < lo || c.wordCount > hi) {
      problems.push(
        `Chapter ${c.idx} is ${c.wordCount} words (target ${lo}–${hi} ≈ 4 min spoken)`,
      );
    }
    if (/\$\s?\d/.test(c.text)) {
      problems.push(`Chapter ${c.idx} contains a digit dollar amount — spell it out`);
    }
  }
  return problems;
}

/**
 * Create the segment YouTubeProject rows for an approved lesson (one per
 * chapter, all pending) and return the segmentsJson entries. Topic mode —
 * the chapter text itself rides as scriptOverride at kick time.
 */
export async function createSegmentProjects(
  lesson: CourseLesson,
  chapters: CourseChapter[],
  userId: string,
): Promise<SegmentEntry[]> {
  const styleId = getCourseStyleId();
  if (!styleId) {
    throw new Error("COURSE_FINLIT_STYLE_ID is not set — pin the locked course style first");
  }
  const entries: SegmentEntry[] = [];
  for (const ch of chapters) {
    const project = await prisma.youTubeProject.create({
      data: {
        userId,
        projectType: "course-segment",
        mode: "topic",
        sourceType: "topic",
        topic: `${lesson.title} — Chapter ${ch.idx}: ${ch.title}`,
        sourceTitle: `L${lesson.order}.${ch.idx} ${ch.title}`,
        goal: `Course lesson ${lesson.order}, chapter ${ch.idx} of ${chapters.length}`,
        targetDuration: SEGMENT_TARGET_MINUTES,
        targetWordCount: ch.wordCount,
        stylePreset: "cinematic",
        styleId,
        // Chapter 1 opener earns more motion; body chapters stay lean.
        animUntilS: ch.idx === 1 ? SEGMENT_ANIM_UNTIL_S.first : SEGMENT_ANIM_UNTIL_S.rest,
        status: "draft",
        scriptMeta: { source: "course-chapter", lessonId: lesson.id, chapterIdx: ch.idx },
      },
    });
    entries.push({ idx: ch.idx, projectId: project.id, status: "pending" });
  }
  return entries;
}

/** Kick one segment's render with its chapter text as the approved script. */
async function kickSegment(entry: SegmentEntry, chapterText: string): Promise<string> {
  const project = await prisma.youTubeProject.findUniqueOrThrow({
    where: { id: entry.projectId },
  });
  const jobId = await startRunCreation(project, { scriptOverride: chapterText });
  await prisma.youTubeProject.update({
    where: { id: project.id },
    data: { autopilotJobId: jobId, status: "in_progress", progress: 5, errorMessage: null },
  });
  return jobId;
}

interface DgxJob {
  status?: string;
  phase?: string;
  progress?: number;
  error?: string;
  result?: Record<string, unknown>;
}

/** Lean version of the YouTube poll route's done-branch mapping for a
 *  finished segment render. Persists media/cost onto the segment row and
 *  returns {videoUrl, durationS, costs}. */
async function persistSegmentResult(
  projectId: string,
  jobId: string,
  result: Record<string, unknown>,
): Promise<{ videoUrl: string | null; durationS: number | null }> {
  const data: Prisma.YouTubeProjectUpdateInput = {
    status: "ready",
    progress: 100,
    completedAt: new Date(),
    errorMessage: null,
  };
  if (typeof result.script === "string") data.script = result.script;
  if (typeof result.audioDuration === "number") data.audioDuration = result.audioDuration;
  if (result.audioUrl || result.audioPath) data.audioUrl = `/vater/file/${jobId}/audio`;
  if (result.captionTimings !== undefined) {
    data.captionTimings = result.captionTimings as Prisma.InputJsonValue;
  }
  const scenes = Array.isArray(result.scenes)
    ? (result.scenes as Array<Record<string, unknown>>)
    : Array.isArray(result.scenesJson)
      ? (result.scenesJson as Array<Record<string, unknown>>)
      : [];
  if (scenes.length > 0) {
    data.scenesJson = scenes.map((s, i) => {
      const idx = typeof s.idx === "number" ? s.idx : i;
      return {
        ...s,
        idx,
        imageUrl: `/api/vater/youtube/${projectId}/scene/${idx}`,
        imagePrompt: (s.prompt as string) ?? (s.imagePrompt as string) ?? "",
        version: 0,
      };
    }) as Prisma.InputJsonValue;
  }

  let videoUrl: string | null = null;
  const finalPath =
    (result.finalVideoUrl as string | undefined) ||
    (result.finalVideoPath as string | undefined);
  if (finalPath) {
    if (finalPath.startsWith("https://")) videoUrl = finalPath;
    else if (finalPath.startsWith("/vater/file/")) videoUrl = finalPath;
    else videoUrl = `/vater/file/${jobId}/video`;
    data.finalVideoUrl = videoUrl;
  }

  const existing = await prisma.youTubeProject.findUnique({
    where: { id: projectId },
    select: { costJson: true },
  });
  if (result.costs && typeof result.costs === "object") {
    const merged = mergeVideoCost(existing?.costJson, result.costs, jobId);
    if (merged) data.costJson = merged as unknown as Prisma.InputJsonValue;
  }
  await prisma.youTubeProject.update({ where: { id: projectId }, data });

  const durationS =
    typeof result.audioDuration === "number"
      ? result.audioDuration
      : typeof result.duration === "number"
        ? (result.duration as number)
        : null;
  return { videoUrl, durationS };
}

/**
 * Advance a lesson's render chain by one poll tick. Safe to call from any
 * poll (idempotent-ish: a lost race on the currentSegment guard means the
 * other poller advanced first and this tick is a no-op). Returns the fresh
 * lesson row.
 */
export async function advanceLessonChain(lessonId: string): Promise<CourseLesson> {
  const lesson = await prisma.courseLesson.findUniqueOrThrow({ where: { id: lessonId } });

  if (lesson.status === "rendering") return advanceRendering(lesson);
  if (lesson.status === "concat") return advanceConcat(lesson);
  return lesson;
}

async function advanceRendering(lesson: CourseLesson): Promise<CourseLesson> {
  const segments = (lesson.segmentsJson as unknown as SegmentEntry[] | null) ?? [];
  const chapters = parseChapters(lesson.scriptDocJson);
  const cur = lesson.currentSegment ?? 0;
  const entry = segments[cur];
  if (!entry || !chapters) {
    return failLesson(lesson.id, "Lesson chain state is malformed (segments/chapters missing)");
  }

  // Segment not kicked yet (fresh approve, or resume after a stall).
  if (!entry.jobId) {
    const project = await prisma.youTubeProject.findUnique({
      where: { id: entry.projectId },
      select: { autopilotJobId: true },
    });
    const jobId =
      project?.autopilotJobId ??
      (await kickSegment(entry, chapters.find((c) => c.idx === entry.idx)!.text));
    segments[cur] = { ...entry, jobId, status: "rendering" };
    return prisma.courseLesson.update({
      where: { id: lesson.id },
      data: { segmentsJson: segments as unknown as Prisma.InputJsonValue },
    });
  }

  let job: DgxJob;
  try {
    job = (await autopilot.getJob(entry.jobId)) as DgxJob;
  } catch (err) {
    if (err instanceof AutopilotError && err.status === 404) {
      // Job evicted from the registry before we saw it finish — the segment
      // project row may still have been mapped by a direct poll; otherwise
      // the human re-kicks via resume.
      return failLesson(
        lesson.id,
        `Segment ${entry.idx} job ${entry.jobId} vanished from the DGX registry — use Resume to re-render it`,
      );
    }
    throw err;
  }

  if (job.status === "failed" || job.status === "cancelled") {
    segments[cur] = { ...entry, status: "failed" };
    await prisma.courseLesson.update({
      where: { id: lesson.id },
      data: { segmentsJson: segments as unknown as Prisma.InputJsonValue },
    });
    return failLesson(
      lesson.id,
      `Segment ${entry.idx} render ${job.status}: ${job.error ?? "unknown error"}`,
    );
  }

  if (job.status !== "done") {
    segments[cur] = {
      ...entry,
      status: "rendering",
      phase: job.phase ?? null,
      progress: job.progress ?? null,
    };
    return prisma.courseLesson.update({
      where: { id: lesson.id },
      data: { segmentsJson: segments as unknown as Prisma.InputJsonValue },
    });
  }

  // Segment done — persist it, fold costs into the lesson rollup, advance.
  const result = job.result ?? {};
  const { videoUrl, durationS } = await persistSegmentResult(
    entry.projectId,
    entry.jobId,
    result,
  );
  segments[cur] = {
    ...entry,
    status: "ready",
    videoUrl,
    durationS,
    phase: "done",
    progress: 100,
  };
  let costJson = lesson.costJson;
  if (result.costs && typeof result.costs === "object") {
    const merged = mergeVideoCost(lesson.costJson, result.costs, entry.jobId);
    if (merged) costJson = merged as unknown as Prisma.JsonValue;
  }

  // Optimistic guard: only the poller that still sees currentSegment === cur
  // advances the chain. A concurrent poll that lost the race no-ops.
  const advanced = await prisma.courseLesson.updateMany({
    where: { id: lesson.id, currentSegment: cur, status: "rendering" },
    data: {
      segmentsJson: segments as unknown as Prisma.InputJsonValue,
      costJson: costJson as Prisma.InputJsonValue,
      currentSegment: Math.min(cur + 1, segments.length - 1),
      ...(cur + 1 >= segments.length ? { status: "concat" } : {}),
    },
  });
  if (advanced.count === 0) {
    return prisma.courseLesson.findUniqueOrThrow({ where: { id: lesson.id } });
  }

  if (cur + 1 < segments.length) {
    // Kick the next segment now rather than waiting one more poll tick.
    const next = segments[cur + 1];
    const chapter = chapters.find((c) => c.idx === next.idx);
    if (chapter) {
      const jobId = await kickSegment(next, chapter.text);
      segments[cur + 1] = { ...next, jobId, status: "rendering" };
      await prisma.courseLesson.update({
        where: { id: lesson.id },
        data: { segmentsJson: segments as unknown as Prisma.InputJsonValue },
      });
    }
    return prisma.courseLesson.findUniqueOrThrow({ where: { id: lesson.id } });
  }

  // All segments ready — kick the concat.
  const { jobId: concatJobId } = await autopilot.concatVideos({
    lessonId: lesson.id,
    projectKey: `course-l${lesson.order}-${lesson.id}`,
    segments: segments.map((s) => ({
      jobId: s.jobId ?? undefined,
      url: s.videoUrl?.startsWith("https://") ? s.videoUrl : undefined,
    })),
  });
  return prisma.courseLesson.update({
    where: { id: lesson.id },
    data: { concatJobId },
  });
}

async function advanceConcat(lesson: CourseLesson): Promise<CourseLesson> {
  if (!lesson.concatJobId) {
    // Reached concat state without a job (crash between updates) — re-kick.
    const segments = (lesson.segmentsJson as unknown as SegmentEntry[] | null) ?? [];
    if (!segments.length || segments.some((s) => s.status !== "ready")) {
      return failLesson(lesson.id, "Concat state without ready segments — use Resume");
    }
    const { jobId } = await autopilot.concatVideos({
      lessonId: lesson.id,
      projectKey: `course-l${lesson.order}-${lesson.id}`,
      segments: segments.map((s) => ({
        jobId: s.jobId ?? undefined,
        url: s.videoUrl?.startsWith("https://") ? s.videoUrl : undefined,
      })),
    });
    return prisma.courseLesson.update({
      where: { id: lesson.id },
      data: { concatJobId: jobId },
    });
  }

  let job: DgxJob;
  try {
    job = (await autopilot.getJob(lesson.concatJobId)) as DgxJob;
  } catch (err) {
    if (err instanceof AutopilotError && err.status === 404) {
      return prisma.courseLesson.update({
        where: { id: lesson.id },
        data: { concatJobId: null }, // next tick re-kicks — concat is cheap
      });
    }
    throw err;
  }
  if (job.status === "failed" || job.status === "cancelled") {
    return failLesson(lesson.id, `Concat ${job.status}: ${job.error ?? "unknown error"}`);
  }
  if (job.status !== "done") return lesson;

  const result = job.result ?? {};
  const finalVideoUrl =
    typeof result.finalVideoUrl === "string" && result.finalVideoUrl.startsWith("https://")
      ? result.finalVideoUrl
      : `/vater/file/${lesson.concatJobId}/video`;
  return prisma.courseLesson.update({
    where: { id: lesson.id },
    data: {
      status: "ready",
      finalVideoUrl,
      durationS: typeof result.durationS === "number" ? result.durationS : null,
      errorMessage: null,
    },
  });
}

async function failLesson(lessonId: string, message: string): Promise<CourseLesson> {
  return prisma.courseLesson.update({
    where: { id: lessonId },
    data: { status: "failed", errorMessage: message.slice(0, 600) },
  });
}

/**
 * Resume a stalled or failed chain: re-enter rendering at the first
 * non-ready segment (clearing a dead jobId so it re-kicks), or re-kick
 * concat when all segments are ready.
 */
export async function resumeLessonChain(lessonId: string): Promise<CourseLesson> {
  const lesson = await prisma.courseLesson.findUniqueOrThrow({ where: { id: lessonId } });
  const segments = (lesson.segmentsJson as unknown as SegmentEntry[] | null) ?? [];
  if (!segments.length) return lesson;

  const firstPending = segments.findIndex((s) => s.status !== "ready");
  if (firstPending === -1) {
    await prisma.courseLesson.update({
      where: { id: lesson.id },
      data: { status: "concat", concatJobId: null, errorMessage: null },
    });
    return advanceLessonChain(lessonId);
  }
  const entry = segments[firstPending];
  if (entry.status === "failed") {
    segments[firstPending] = { ...entry, jobId: null, status: "pending", phase: null, progress: null };
  }
  await prisma.courseLesson.update({
    where: { id: lesson.id },
    data: {
      status: "rendering",
      currentSegment: firstPending,
      segmentsJson: segments as unknown as Prisma.InputJsonValue,
      errorMessage: null,
    },
  });
  return advanceLessonChain(lessonId);
}

/** Rollup helper for the UI cost line. */
export function lessonCostUsd(lesson: CourseLesson): number | null {
  const c = parseVideoCost(lesson.costJson);
  return c?.totalUsd ?? null;
}
