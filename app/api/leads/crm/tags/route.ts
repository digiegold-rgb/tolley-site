// @ts-nocheck — references removed Prisma models
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/**
 * GET /api/leads/crm/tags
 *
 * List all tags for the subscriber.
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

    const tags = await prisma.tag.findMany({
      where: { subscriberId: sub.id },
      orderBy: { name: "asc" },
      include: {
        _count: { select: { contacts: true } },
      },
    });

    return NextResponse.json({ tags });
  } catch (err) {
    console.error("[CRM Tags GET]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/leads/crm/tags
 *
 * Create a new tag.
 * Body: { name, color?, category? }
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
    const { name, color, category } = body;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json({ error: "Tag name is required" }, { status: 400 });
    }

    const tag = await prisma.tag.create({
      data: {
        subscriberId: sub.id,
        name: name.trim(),
        ...(color ? { color } : {}),
        ...(category ? { category } : {}),
      },
    });

    return NextResponse.json({ tag }, { status: 201 });
  } catch (err: unknown) {
    if (err && typeof err === "object" && "code" in err && (err as { code: string }).code === "P2002") {
      return NextResponse.json({ error: "Tag with this name already exists" }, { status: 409 });
    }
    console.error("[CRM Tags POST]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * PATCH /api/leads/crm/tags
 *
 * Update a tag.
 * Body: { id, name?, color?, category? }
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
    const { id, name, color, category } = body;

    if (!id || typeof id !== "string") {
      return NextResponse.json({ error: "Tag id is required" }, { status: 400 });
    }

    // Verify ownership
    const existing = await prisma.tag.findUnique({ where: { id } });
    if (!existing || existing.subscriberId !== sub.id) {
      return NextResponse.json({ error: "Tag not found" }, { status: 404 });
    }

    const data: Record<string, unknown> = {};
    if (name !== undefined) data.name = name.trim();
    if (color !== undefined) data.color = color;
    if (category !== undefined) data.category = category;

    const tag = await prisma.tag.update({
      where: { id },
      data,
    });

    return NextResponse.json({ tag });
  } catch (err: unknown) {
    if (err && typeof err === "object" && "code" in err && (err as { code: string }).code === "P2002") {
      return NextResponse.json({ error: "Tag with this name already exists" }, { status: 409 });
    }
    console.error("[CRM Tags PATCH]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * DELETE /api/leads/crm/tags?id=xxx
 *
 * Delete a tag. Cascade deletes ContactTag entries.
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
      return NextResponse.json({ error: "Tag id is required" }, { status: 400 });
    }

    // Verify ownership
    const existing = await prisma.tag.findUnique({ where: { id } });
    if (!existing || existing.subscriberId !== sub.id) {
      return NextResponse.json({ error: "Tag not found" }, { status: 404 });
    }

    // Cascade is handled by Prisma schema (onDelete: Cascade on ContactTag.tagId)
    await prisma.tag.delete({ where: { id } });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[CRM Tags DELETE]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
