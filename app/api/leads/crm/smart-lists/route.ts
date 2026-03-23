// @ts-nocheck — references removed Prisma models
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/**
 * GET /api/leads/crm/smart-lists
 *
 * List all smart lists for the subscriber.
 */
export async function GET() {
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

    const smartLists = await prisma.smartList.findMany({
      where: { subscriberId: sub.id },
      orderBy: [{ isPinned: "desc" }, { name: "asc" }],
    });

    const serialized = smartLists.map((s) => ({
      ...s,
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
    }));

    return NextResponse.json({ smartLists: serialized });
  } catch (err) {
    console.error("[CRM SmartLists GET]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/leads/crm/smart-lists
 *
 * Create a smart list.
 * Body: { name, icon?, filters, sortBy?, sortDir?, isPinned? }
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
    const { name, icon, filters, sortBy, sortDir, isPinned } = body;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json({ error: "Smart list name is required" }, { status: 400 });
    }
    if (!filters || typeof filters !== "object") {
      return NextResponse.json({ error: "Filters object is required" }, { status: 400 });
    }

    const smartList = await prisma.smartList.create({
      data: {
        subscriberId: sub.id,
        name: name.trim(),
        ...(icon ? { icon } : {}),
        filters,
        ...(sortBy ? { sortBy } : {}),
        ...(sortDir ? { sortDir } : {}),
        ...(isPinned !== undefined ? { isPinned } : {}),
      },
    });

    return NextResponse.json(
      {
        smartList: {
          ...smartList,
          createdAt: smartList.createdAt.toISOString(),
          updatedAt: smartList.updatedAt.toISOString(),
        },
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("[CRM SmartLists POST]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * PATCH /api/leads/crm/smart-lists
 *
 * Update a smart list.
 * Body: { id, name?, icon?, filters?, sortBy?, sortDir?, isPinned? }
 */
export async function PATCH(request: NextRequest) {
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
    const { id, name, icon, filters, sortBy, sortDir, isPinned } = body;

    if (!id || typeof id !== "string") {
      return NextResponse.json({ error: "Smart list id is required" }, { status: 400 });
    }

    // Verify ownership
    const existing = await prisma.smartList.findUnique({ where: { id } });
    if (!existing || existing.subscriberId !== sub.id) {
      return NextResponse.json({ error: "Smart list not found" }, { status: 404 });
    }

    const data: Record<string, unknown> = {};
    if (name !== undefined) data.name = name.trim();
    if (icon !== undefined) data.icon = icon;
    if (filters !== undefined) data.filters = filters;
    if (sortBy !== undefined) data.sortBy = sortBy;
    if (sortDir !== undefined) data.sortDir = sortDir;
    if (isPinned !== undefined) data.isPinned = isPinned;

    const smartList = await prisma.smartList.update({
      where: { id },
      data,
    });

    return NextResponse.json({
      smartList: {
        ...smartList,
        createdAt: smartList.createdAt.toISOString(),
        updatedAt: smartList.updatedAt.toISOString(),
      },
    });
  } catch (err) {
    console.error("[CRM SmartLists PATCH]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * DELETE /api/leads/crm/smart-lists?id=xxx
 *
 * Delete a smart list.
 */
export async function DELETE(request: NextRequest) {
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

    const id = request.nextUrl.searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Smart list id is required" }, { status: 400 });
    }

    // Verify ownership
    const existing = await prisma.smartList.findUnique({ where: { id } });
    if (!existing || existing.subscriberId !== sub.id) {
      return NextResponse.json({ error: "Smart list not found" }, { status: 404 });
    }

    await prisma.smartList.delete({ where: { id } });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[CRM SmartLists DELETE]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
