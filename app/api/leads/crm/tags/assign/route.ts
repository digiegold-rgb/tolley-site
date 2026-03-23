// @ts-nocheck — references removed Prisma models
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/**
 * POST /api/leads/crm/tags/assign
 *
 * Assign a tag to a lead or client.
 * Body: { tagId, leadId?, clientId? }
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
    const { tagId, leadId, clientId } = body;

    if (!tagId || typeof tagId !== "string") {
      return NextResponse.json({ error: "tagId is required" }, { status: 400 });
    }
    if (!leadId && !clientId) {
      return NextResponse.json({ error: "Either leadId or clientId is required" }, { status: 400 });
    }

    // Verify tag ownership
    const tag = await prisma.tag.findUnique({ where: { id: tagId } });
    if (!tag || tag.subscriberId !== sub.id) {
      return NextResponse.json({ error: "Tag not found" }, { status: 404 });
    }

    // Create assignment
    const contactTag = await prisma.contactTag.create({
      data: {
        tagId,
        ...(leadId ? { leadId } : {}),
        ...(clientId ? { clientId } : {}),
      },
      include: { tag: true },
    });

    // Log activity
    await prisma.crmActivity.create({
      data: {
        subscriberId: sub.id,
        ...(leadId ? { leadId } : {}),
        ...(clientId ? { clientId } : {}),
        type: "tag_added",
        title: `Tagged as ${tag.name}`,
        metadata: { tagId, tagName: tag.name },
      },
    });

    return NextResponse.json({ contactTag }, { status: 201 });
  } catch (err: unknown) {
    if (err && typeof err === "object" && "code" in err && (err as { code: string }).code === "P2002") {
      return NextResponse.json({ error: "Tag already assigned" }, { status: 409 });
    }
    console.error("[CRM Tags Assign POST]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * DELETE /api/leads/crm/tags/assign
 *
 * Remove a tag assignment from a lead or client.
 * Body: { tagId, leadId?, clientId? }
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

    const body = await request.json();
    const { tagId, leadId, clientId } = body;

    if (!tagId || typeof tagId !== "string") {
      return NextResponse.json({ error: "tagId is required" }, { status: 400 });
    }
    if (!leadId && !clientId) {
      return NextResponse.json({ error: "Either leadId or clientId is required" }, { status: 400 });
    }

    // Get tag name for activity log
    const tag = await prisma.tag.findUnique({ where: { id: tagId } });
    if (!tag || tag.subscriberId !== sub.id) {
      return NextResponse.json({ error: "Tag not found" }, { status: 404 });
    }

    // Find and delete the assignment
    if (leadId) {
      await prisma.contactTag.delete({
        where: { tagId_leadId: { tagId, leadId } },
      });
    } else if (clientId) {
      await prisma.contactTag.delete({
        where: { tagId_clientId: { tagId, clientId } },
      });
    }

    // Log activity
    await prisma.crmActivity.create({
      data: {
        subscriberId: sub.id,
        ...(leadId ? { leadId } : {}),
        ...(clientId ? { clientId } : {}),
        type: "tag_removed",
        title: `Removed tag ${tag.name}`,
        metadata: { tagId, tagName: tag.name },
      },
    });

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    if (err && typeof err === "object" && "code" in err && (err as { code: string }).code === "P2025") {
      return NextResponse.json({ error: "Tag assignment not found" }, { status: 404 });
    }
    console.error("[CRM Tags Assign DELETE]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
