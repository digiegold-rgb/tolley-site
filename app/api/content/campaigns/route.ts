import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminApiSession } from "@/lib/admin-auth";
import { secretEquals } from "@/lib/secret-compare";

/**
 * GET /api/content/campaigns — list campaigns
 * POST /api/content/campaigns — create campaign
 *
 * Auth: admin session OR `x-sync-secret` header. The `?key=` query-param path
 * was removed (secret-in-URL leak).
 */
async function authorize(req: NextRequest): Promise<boolean> {
  const syncSecret = process.env.SYNC_SECRET;
  if (syncSecret && secretEquals(req.headers.get("x-sync-secret"), syncSecret)) {
    return true;
  }
  const admin = await requireAdminApiSession();
  return admin.ok;
}

export async function GET(req: NextRequest) {
  if (!(await authorize(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const subscriberId = req.nextUrl.searchParams.get("subscriberId");

  const where: Record<string, unknown> = {};
  if (subscriberId) where.subscriberId = subscriberId;

  const campaigns = await prisma.contentCampaign.findMany({
    where,
    include: {
      _count: { select: { posts: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ campaigns });
}

export async function POST(req: NextRequest) {
  if (!(await authorize(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const {
    subscriberId,
    name,
    description,
    platforms,
    templateIds,
    frequency,
    postsPerDay,
    preferredTimes,
    timezone,
    sourceType,
    sourceFilter,
    startDate,
    endDate,
  } = body;

  if (!subscriberId || !name || !platforms?.length) {
    return NextResponse.json(
      { error: "subscriberId, name, platforms required" },
      { status: 400 }
    );
  }

  const campaign = await prisma.contentCampaign.create({
    data: {
      subscriberId,
      name,
      description: description || null,
      platforms,
      templateIds: templateIds || [],
      frequency: frequency || "daily",
      postsPerDay: postsPerDay || 1,
      preferredTimes: preferredTimes || ["09:00", "17:00"],
      timezone: timezone || "America/Chicago",
      sourceType: sourceType || "ai_generated",
      sourceFilter: sourceFilter || null,
      startDate: startDate ? new Date(startDate) : null,
      endDate: endDate ? new Date(endDate) : null,
      isActive: false, // start inactive, user activates
    },
  });

  return NextResponse.json({ campaign }, { status: 201 });
}
