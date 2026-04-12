/**
 * GET /api/vater/rss/[id]/items → recent items for a feed
 *
 * Query params:
 *   limit (default 50, max 200)
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const limitRaw = Number(req.nextUrl.searchParams.get("limit") ?? "50");
  const limit = Math.min(
    200,
    Math.max(1, Number.isFinite(limitRaw) ? limitRaw : 50),
  );

  const feed = await prisma.vaterRssFeed.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!feed) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const items = await prisma.vaterRssItem.findMany({
    where: { feedId: id },
    orderBy: { discoveredAt: "desc" },
    take: limit,
    include: {
      project: { select: { id: true, status: true } },
    },
  });

  return NextResponse.json({ items });
}
