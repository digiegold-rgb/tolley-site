import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET/PUT/DELETE/PATCH /api/content/campaigns/[id]
 */

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const syncSecret = process.env.SYNC_SECRET;
  const auth =
    req.headers.get("x-sync-secret") ||
    req.nextUrl.searchParams.get("key");
  if (!syncSecret || auth !== syncSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const campaign = await prisma.contentCampaign.findUnique({
    where: { id },
    include: {
      posts: {
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
          platform: true,
          body: true,
          status: true,
          scheduledAt: true,
          publishedAt: true,
          likes: true,
          comments: true,
          shares: true,
          impressions: true,
          engagementRate: true,
        },
      },
      _count: { select: { posts: true } },
    },
  });

  if (!campaign) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ campaign });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const syncSecret = process.env.SYNC_SECRET;
  const auth = req.headers.get("x-sync-secret");
  if (!syncSecret || auth !== syncSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();

  const campaign = await prisma.contentCampaign.update({
    where: { id },
    data: {
      ...(body.name !== undefined && { name: body.name }),
      ...(body.description !== undefined && { description: body.description }),
      ...(body.platforms !== undefined && { platforms: body.platforms }),
      ...(body.templateIds !== undefined && { templateIds: body.templateIds }),
      ...(body.frequency !== undefined && { frequency: body.frequency }),
      ...(body.postsPerDay !== undefined && { postsPerDay: body.postsPerDay }),
      ...(body.preferredTimes !== undefined && { preferredTimes: body.preferredTimes }),
      ...(body.timezone !== undefined && { timezone: body.timezone }),
      ...(body.sourceType !== undefined && { sourceType: body.sourceType }),
      ...(body.sourceFilter !== undefined && { sourceFilter: body.sourceFilter }),
      ...(body.startDate !== undefined && { startDate: body.startDate ? new Date(body.startDate) : null }),
      ...(body.endDate !== undefined && { endDate: body.endDate ? new Date(body.endDate) : null }),
    },
  });

  return NextResponse.json({ campaign });
}

/** PATCH — toggle active/inactive */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const syncSecret = process.env.SYNC_SECRET;
  const auth = req.headers.get("x-sync-secret");
  if (!syncSecret || auth !== syncSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();

  if (body.isActive === undefined) {
    return NextResponse.json({ error: "isActive required" }, { status: 400 });
  }

  const campaign = await prisma.contentCampaign.update({
    where: { id },
    data: { isActive: body.isActive },
  });

  return NextResponse.json({ campaign });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const syncSecret = process.env.SYNC_SECRET;
  const auth = req.headers.get("x-sync-secret");
  if (!syncSecret || auth !== syncSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  // Delete associated posts first, then campaign
  await prisma.contentPost.deleteMany({ where: { campaignId: id } });
  await prisma.contentCampaign.delete({ where: { id } }).catch(() => null);
  return NextResponse.json({ ok: true });
}
