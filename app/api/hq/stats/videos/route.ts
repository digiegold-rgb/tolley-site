import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateWdAdmin } from "@/lib/wd-auth";

export const runtime = "nodejs";
export const maxDuration = 60;

const PIPELINES = ["shorts", "housing", "listings", "estate", "other"] as const;

function isPipeline(v: unknown): v is (typeof PIPELINES)[number] {
  return typeof v === "string" && (PIPELINES as readonly string[]).includes(v);
}

/**
 * POST /api/hq/stats/videos — DGX pushes videoId → pipeline attribution
 * (push-video-map.mjs, x-sync-secret auth). Body:
 *   [{ videoId, pipeline, title?, publishedAt? }]
 * Rows the stats cron hasn't seen yet are created with placeholder metadata
 * the next pull overwrites.
 */
export async function POST(request: NextRequest) {
  const syncSecret = process.env.SYNC_SECRET;
  const authHeader = request.headers.get("x-sync-secret");
  if (!syncSecret || authHeader !== syncSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!Array.isArray(body)) {
    return NextResponse.json({ error: "Expected an array" }, { status: 400 });
  }

  let upserted = 0;
  for (const raw of body) {
    if (!raw || typeof raw !== "object") continue;
    const item = raw as Record<string, unknown>;
    const videoId = typeof item.videoId === "string" ? item.videoId.trim() : "";
    if (!videoId || !isPipeline(item.pipeline)) continue;
    const title = typeof item.title === "string" && item.title.trim() ? item.title.trim() : null;
    const publishedAt =
      typeof item.publishedAt === "string" && !Number.isNaN(Date.parse(item.publishedAt))
        ? new Date(item.publishedAt)
        : null;

    await prisma.youTubeVideo.upsert({
      where: { videoId },
      create: {
        videoId,
        pipeline: item.pipeline,
        title: title ?? videoId,
        publishedAt: publishedAt ?? new Date(),
      },
      update: {
        pipeline: item.pipeline,
        ...(title ? { title } : {}),
        ...(publishedAt ? { publishedAt } : {}),
      },
    });
    upserted++;
  }

  return NextResponse.json({ ok: true, upserted });
}

/**
 * PATCH — manual pipeline reassignment from the Stats tab (PIN auth).
 * Body: { videoId, pipeline }.
 */
export async function PATCH(request: NextRequest) {
  const { authed } = await validateWdAdmin();
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const videoId = typeof body.videoId === "string" ? body.videoId.trim() : "";
  if (!videoId || !isPipeline(body.pipeline)) {
    return NextResponse.json({ error: "videoId + valid pipeline required" }, { status: 400 });
  }

  try {
    const video = await prisma.youTubeVideo.update({
      where: { videoId },
      data: { pipeline: body.pipeline },
    });
    return NextResponse.json({ ok: true, video });
  } catch {
    return NextResponse.json({ error: "Video not found" }, { status: 404 });
  }
}
