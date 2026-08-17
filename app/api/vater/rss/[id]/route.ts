/**
 * GET    /api/vater/rss/[id]   → fetch one feed + recent items
 * PATCH  /api/vater/rss/[id]   → toggle autoPipeline / defaults
 * DELETE /api/vater/rss/[id]   → cascade-delete feed + items
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { isVaterAdminEmail } from "@/lib/admin-auth";

/** Resolve the caller and the feed; 401/404 as NextResponse when not theirs. */
async function ownFeed(id: string) {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  const owned = await prisma.vaterRssFeed.findFirst({
    where: { id, userId: session.user.id },
    select: { id: true },
  });
  if (!owned) {
    return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  }
  return { session };
}

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const own = await ownFeed(id);
  if (own.error) return own.error;
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
  const own = await ownFeed(id);
  if (own.error) return own.error;
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
  // autoPipeline = unattended spend; owner-only for now.
  if (data.autoPipeline === true && !isVaterAdminEmail(own.session?.user?.email)) {
    return NextResponse.json(
      { error: "Auto-render is not available on your plan yet. New items still land in this feed — promote them with one click." },
      { status: 403 },
    );
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
  const own = await ownFeed(id);
  if (own.error) return own.error;
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
