/**
 * POST /api/vater/socials/schedule-batch
 *
 * Body: { projectIds, platforms, startAt ISO, timezone, perDay default 1,
 *         timeOfDay HH:mm, pinterestBoardId?, batchId? }
 *
 * Consent: nothing is created until this POST (the confirm click). The
 * server never reschedules or extends a batch. Same batchId retry returns
 * the existing rows — it does not double-book.
 */
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canAccessProject } from "@/lib/vater/project-access";
import { isZernioEnabled, ZernioError } from "@/lib/vater/social-vendor/zernio";
import { quoteDripBatch } from "@/lib/vater/socials/billing";
import { jsonSafe } from "@/lib/vater/socials/json";
import { batchAlreadyBooked } from "@/lib/vater/socials/match";
import { parseVendorPlatforms, publishSocialPost } from "@/lib/vater/socials/publish-core";
import { dripRequestId, enumerateDripSlots } from "@/lib/vater/socials/schedule";
import { isMissingSchemaError } from "@/lib/vater/schema-probe";

interface Body {
  projectIds?: unknown;
  platforms?: unknown;
  startAt?: unknown;
  timezone?: unknown;
  perDay?: unknown;
  timeOfDay?: unknown;
  pinterestBoardId?: unknown;
  batchId?: unknown;
}

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isZernioEnabled()) {
    return NextResponse.json(
      { error: "Direct social publishing is not enabled on this deployment." },
      { status: 503 },
    );
  }
  const userId = session.user.id;
  const body = (await req.json().catch(() => ({}))) as Body;

  const projectIds = Array.isArray(body.projectIds)
    ? body.projectIds.filter((id): id is string => typeof id === "string" && !!id.trim())
    : [];
  if (projectIds.length === 0) {
    return NextResponse.json({ error: "Pick at least one video" }, { status: 400 });
  }
  const platforms = parseVendorPlatforms(body.platforms);
  if (platforms.length === 0) {
    return NextResponse.json({ error: "Pick at least one connected platform" }, { status: 400 });
  }
  if (typeof body.startAt !== "string" || !body.startAt) {
    return NextResponse.json({ error: "startAt (ISO) is required" }, { status: 400 });
  }
  const startAt = new Date(body.startAt);
  if (Number.isNaN(startAt.getTime())) {
    return NextResponse.json({ error: "startAt must be a valid ISO timestamp" }, { status: 400 });
  }
  const timezone = typeof body.timezone === "string" && body.timezone ? body.timezone : "UTC";
  const perDay = typeof body.perDay === "number" ? body.perDay : Number(body.perDay ?? 1) || 1;
  const timeOfDay = typeof body.timeOfDay === "string" && body.timeOfDay ? body.timeOfDay : "09:00";
  const pinterestBoardId =
    typeof body.pinterestBoardId === "string" && body.pinterestBoardId
      ? body.pinterestBoardId
      : undefined;
  if (platforms.includes("pinterest") && !pinterestBoardId) {
    return NextResponse.json({ error: "Pinterest needs a board" }, { status: 400 });
  }

  const projects = await prisma.youTubeProject.findMany({
    where: { id: { in: projectIds } },
  });
  const byId = new Map(projects.map((p) => [p.id, p]));
  for (const id of projectIds) {
    const project = byId.get(id);
    if (!project || !canAccessProject(project.userId, userId, session.user.email)) {
      return NextResponse.json({ error: `Project not found: ${id}` }, { status: 404 });
    }
    if (project.status !== "ready" || !project.finalVideoUrl) {
      return NextResponse.json(
        { error: `Project is not finished yet (status '${project.status}')` },
        { status: 409 },
      );
    }
  }

  const batchId =
    typeof body.batchId === "string" && body.batchId.trim()
      ? body.batchId.trim().slice(0, 80)
      : randomUUID();

  try {
    const existing = await prisma.vaterSocialPost.findMany({
      where: { userId, batchId },
    });
    if (batchAlreadyBooked(existing.length)) {
      return NextResponse.json(
        jsonSafe({ posts: existing, batchId, reused: true }),
      );
    }
  } catch (err) {
    if (!isMissingSchemaError(err)) throw err;
    // batchId column missing — continue; Zernio requestId still dedupes.
  }

  const quote = await quoteDripBatch(userId, projectIds.length);
  if (!quote.allow) {
    return NextResponse.json(
      {
        error: "Insufficient credit for this drip batch",
        total: quote.totalCents,
        totalCents: quote.totalCents,
        balanceCents: quote.balanceCents,
      },
      { status: 402 },
    );
  }

  const slots = enumerateDripSlots({
    startAt,
    timezone,
    perDay,
    timeOfDay,
    count: projectIds.length,
  });

  const posts = [];
  const errors: Array<{ projectId: string; error: string }> = [];
  for (let i = 0; i < projectIds.length; i++) {
    const project = byId.get(projectIds[i])!;
    const slot = slots[i];
    try {
      const result = await publishSocialPost({
        userId,
        project,
        platforms,
        caption: (project.description ?? project.publishTitle ?? project.sourceTitle ?? "").trim(),
        scheduledFor: slot.wallClock,
        timezone,
        pinterest: pinterestBoardId ? { boardId: pinterestBoardId } : undefined,
        requestId: dripRequestId(batchId, i),
        batchId,
      });
      if (!result.ok) {
        errors.push({ projectId: project.id, error: result.error });
        continue;
      }
      posts.push(result.post);
    } catch (err) {
      if (err instanceof ZernioError) {
        let msg = err.body;
        try {
          msg = (JSON.parse(err.body) as { error?: string }).error ?? err.body;
        } catch {
          /* raw */
        }
        errors.push({ projectId: project.id, error: msg.slice(0, 300) });
      } else {
        errors.push({
          projectId: project.id,
          error: err instanceof Error ? err.message : "Publish failed",
        });
      }
    }
  }

  return NextResponse.json(
    jsonSafe({
      posts,
      batchId,
      quote,
      errors: errors.length ? errors : undefined,
    }),
    { status: errors.length && !posts.length ? 502 : 200 },
  );
}
