/**
 * GET    /api/vater/rss/[id]   → fetch one feed + recent items
 * PATCH  /api/vater/rss/[id]   → toggle autoPipeline / defaults
 * DELETE /api/vater/rss/[id]   → cascade-delete feed + items
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const feed = await prisma.vaterRssFeed.findUnique({
    where: { id },
    include: {
      items: { orderBy: { discoveredAt: "desc" }, take: 20 },
    },
  });
  if (!feed) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ feed });
}

const ALLOWED_PATCH_FIELDS = [
  "autoPipeline",
  "defaultGoal",
  "defaultWords",
  "defaultVoiceId",
  "defaultStyle",
  "title",
] as const;

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const data: Record<string, unknown> = {};
  for (const key of ALLOWED_PATCH_FIELDS) {
    if (body[key] !== undefined) data[key] = body[key];
  }
  if (Object.keys(data).length === 0) {
    return NextResponse.json(
      { error: "No allowed fields in body" },
      { status: 400 },
    );
  }

  try {
    const feed = await prisma.vaterRssFeed.update({ where: { id }, data });
    return NextResponse.json({ feed });
  } catch (err) {
    return NextResponse.json(
      {
        error: "Update failed",
        detail: err instanceof Error ? err.message : "unknown",
      },
      { status: 404 },
    );
  }
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  try {
    await prisma.vaterRssFeed.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      {
        error: "Delete failed",
        detail: err instanceof Error ? err.message : "unknown",
      },
      { status: 404 },
    );
  }
}
