// @ts-nocheck — references removed Prisma models
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/**
 * GET /api/leads/crm/activities
 *
 * List activities for a contact or deal.
 * Query params: leadId, clientId, dealId, limit (default 50), offset (default 0)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const sub = await prisma.leadSubscriber.findUnique({
      where: { userId },
    });
    if (!sub || sub.status !== "active") {
      return NextResponse.json({ error: "No active subscription" }, { status: 403 });
    }

    const params = request.nextUrl.searchParams;
    const leadId = params.get("leadId");
    const clientId = params.get("clientId");
    const dealId = params.get("dealId");
    const limit = Math.min(Number(params.get("limit")) || 50, 200);
    const offset = Number(params.get("offset")) || 0;

    const where: Record<string, unknown> = { subscriberId: sub.id };
    if (leadId) where.leadId = leadId;
    if (clientId) where.clientId = clientId;
    if (dealId) where.dealId = dealId;

    const [activities, total] = await Promise.all([
      prisma.crmActivity.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.crmActivity.count({ where }),
    ]);

    const serialized = activities.map((a) => ({
      ...a,
      createdAt: a.createdAt.toISOString(),
    }));

    return NextResponse.json({ activities: serialized, total, limit, offset });
  } catch (err) {
    console.error("[CRM Activities GET]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/leads/crm/activities
 *
 * Log a manual activity (call, note, etc.).
 * Body: { leadId?, clientId?, dealId?, type, title, description?, metadata? }
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const sub = await prisma.leadSubscriber.findUnique({
      where: { userId },
    });
    if (!sub || sub.status !== "active") {
      return NextResponse.json({ error: "No active subscription" }, { status: 403 });
    }

    const body = await request.json();
    const { leadId, clientId, dealId, type, title, description, metadata } = body;

    if (!type || typeof type !== "string") {
      return NextResponse.json({ error: "Activity type is required" }, { status: 400 });
    }
    if (!title || typeof title !== "string") {
      return NextResponse.json({ error: "Activity title is required" }, { status: 400 });
    }

    const activity = await prisma.crmActivity.create({
      data: {
        subscriberId: sub.id,
        ...(leadId ? { leadId } : {}),
        ...(clientId ? { clientId } : {}),
        ...(dealId ? { dealId } : {}),
        type,
        title,
        ...(description ? { description } : {}),
        ...(metadata ? { metadata } : {}),
      },
    });

    return NextResponse.json(
      {
        activity: {
          ...activity,
          createdAt: activity.createdAt.toISOString(),
        },
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("[CRM Activities POST]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
