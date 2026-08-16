/**
 * GET /api/vater/youtube/[id]/chapters
 *   → { chapters: [{ startSec, title }], hashtags: string[], via }
 *
 * Powers "Add chapters + hashtags" in the Description step. Primary path is
 * DGX `GET /vater/projects/{projectId}/chapters`, which knows the planner's
 * section headers. When that isn't shipped yet we derive a usable set from
 * the scene schedule already stored on the row (`scenesJson[].startS` +
 * `beatText`), so the button still does something real instead of greying out.
 *
 * YouTube's rules for chapters to actually register: at least three, the
 * first one at 0:00, each at least 10 seconds long. The fallback honours all
 * three — and returns NO chapters at all rather than an invalid set, because
 * a half-valid list silently does nothing on YouTube.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { checkProjectAccess } from "@/lib/vater/project-access";
import { dgxCall } from "@/lib/vater/dgx-feature-proxy";

export const maxDuration = 60;

type Ctx = { params: Promise<{ id: string }> };

export interface Chapter {
  startSec: number;
  title: string;
}

type DgxChapters = Chapter[] | { chapters?: Chapter[]; hashtags?: string[] };

const MIN_CHAPTERS = 3;
const MAX_CHAPTERS = 8;
const MIN_CHAPTER_SEC = 10;
/** Aim for a chapter roughly this often; clamped by MIN/MAX above. */
const TARGET_CHAPTER_SEC = 75;

const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "but", "of", "to", "in", "on", "for", "with",
  "is", "are", "was", "were", "it", "its", "this", "that", "you", "your",
  "we", "our", "they", "their", "he", "she", "his", "her", "as", "at", "by",
  "from", "so", "if", "then", "than", "just", "not", "be", "been", "have",
  "has", "had", "do", "does", "did", "can", "will", "would", "about",
]);

type SceneRow = { idx?: number; startS?: number; beatText?: string };

function readScenes(scenesJson: unknown): SceneRow[] {
  if (!Array.isArray(scenesJson)) return [];
  return scenesJson
    .filter((s): s is Record<string, unknown> => Boolean(s) && typeof s === "object")
    .map((s, i) => ({
      idx: typeof s.idx === "number" ? s.idx : i,
      startS: typeof s.startS === "number" ? s.startS : undefined,
      beatText: typeof s.beatText === "string" ? s.beatText : undefined,
    }))
    .sort((a, b) => (a.idx ?? 0) - (b.idx ?? 0));
}

/** First few meaningful words of a beat, as a chapter title. */
function titleFromBeat(beat: string | undefined, fallback: string): string {
  if (!beat) return fallback;
  const words = beat
    .replace(/["“”'’]/g, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 6);
  if (words.length === 0) return fallback;
  const text = words.join(" ").replace(/[.,;:!?—-]+$/, "").trim();
  if (!text) return fallback;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function deriveChapters(scenes: SceneRow[], durationSec: number | null): Chapter[] {
  const timed = scenes.filter(
    (s): s is SceneRow & { startS: number } => typeof s.startS === "number",
  );
  if (timed.length < MIN_CHAPTERS) return [];

  const total =
    durationSec && durationSec > 0
      ? durationSec
      : timed[timed.length - 1].startS + TARGET_CHAPTER_SEC;
  if (total < MIN_CHAPTERS * MIN_CHAPTER_SEC) return [];

  const wanted = Math.max(
    MIN_CHAPTERS,
    Math.min(MAX_CHAPTERS, Math.round(total / TARGET_CHAPTER_SEC)),
  );

  const chapters: Chapter[] = [{ startSec: 0, title: "Intro" }];
  const step = total / wanted;
  for (let i = 1; i < wanted; i += 1) {
    const targetSec = step * i;
    // Snap to the scene that starts at or after the target — chapters should
    // land on a cut, not mid-shot.
    const scene =
      timed.find((s) => s.startS >= targetSec) ?? timed[timed.length - 1];
    const startSec = Math.round(scene.startS);
    const prev = chapters[chapters.length - 1];
    if (startSec - prev.startSec < MIN_CHAPTER_SEC) continue;
    chapters.push({
      startSec,
      title: titleFromBeat(scene.beatText, `Part ${chapters.length + 1}`),
    });
  }

  return chapters.length >= MIN_CHAPTERS ? chapters : [];
}

/** #PascalCase tags off the existing SEO tags, else the title's keywords. */
function deriveHashtags(tags: string[], title: string | null): string[] {
  const source = tags.length
    ? tags
    : (title ?? "")
        .split(/\s+/)
        .map((w) => w.replace(/[^A-Za-z0-9]/g, ""))
        .filter((w) => w.length > 2 && !STOPWORDS.has(w.toLowerCase()));

  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of source) {
    const tag = raw
      .split(/[\s\-_]+/)
      .map((w) => w.replace(/[^A-Za-z0-9]/g, ""))
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join("");
    if (!tag || tag.length < 3) continue;
    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(`#${tag}`);
    if (out.length === 5) break;
  }
  return out;
}

export async function GET(_req: NextRequest, ctx: Ctx) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const access = await checkProjectAccess(id, session.user.id, session.user.email);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const project = await prisma.youTubeProject.findUnique({
    where: { id },
    select: {
      scenesJson: true,
      audioDuration: true,
      tags: true,
      publishTitle: true,
      sourceTitle: true,
      topic: true,
    },
  });
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const title = project.publishTitle ?? project.sourceTitle ?? project.topic ?? null;
  const fallbackHashtags = deriveHashtags(project.tags ?? [], title);

  const dgx = await dgxCall<DgxChapters>(
    "GET",
    `/vater/projects/${encodeURIComponent(id)}/chapters`,
  );

  if (dgx.kind === "ok") {
    const raw = Array.isArray(dgx.data) ? dgx.data : (dgx.data.chapters ?? []);
    const chapters = raw
      .filter(
        (c): c is Chapter =>
          Boolean(c) && typeof c.startSec === "number" && typeof c.title === "string",
      )
      .map((c) => ({ startSec: Math.max(0, Math.round(c.startSec)), title: c.title }));
    const hashtags =
      (!Array.isArray(dgx.data) && dgx.data.hashtags?.length
        ? dgx.data.hashtags
        : fallbackHashtags) ?? [];
    return NextResponse.json({ chapters, hashtags, via: "dgx" });
  }

  if (dgx.kind === "error") {
    return NextResponse.json(
      { error: "Chapters failed", detail: dgx.body.slice(0, 300) },
      { status: 502 },
    );
  }

  // Fallback — derive from the scene schedule already on the row.
  const chapters = deriveChapters(readScenes(project.scenesJson), project.audioDuration);
  if (chapters.length === 0 && fallbackHashtags.length === 0) {
    return NextResponse.json(
      {
        error: "Nothing to build chapters from yet",
        unavailable: true,
        detail:
          "The DGX endpoint isn't shipped and this project has no scene timings yet — render the scenes first.",
      },
      { status: 501 },
    );
  }

  return NextResponse.json({
    chapters,
    hashtags: fallbackHashtags,
    via: "site-fallback",
  });
}
