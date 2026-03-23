import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const VALID_STAGES = [
  "new",
  "contacted",
  "interested",
  "referred",
  "closed",
  "dead",
] as const;

const STAGE_LABELS: Record<string, string> = {
  new: "New Lead",
  contacted: "Contacted",
  interested: "Interested",
  referred: "Referred",
  closed: "Closed",
  dead: "Dead",
};

/**
 * GET /api/leads/crm/pipeline
 *
 * Fetch all leads for the Kanban board grouped by status.
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

    const where: Record<string, unknown> = {};
    if (sub.farmZips && sub.farmZips.length > 0) {
      where.listing = { zip: { in: sub.farmZips } };
    }

    const leads = await prisma.lead.findMany({
      where,
      include: {
        listing: {
          select: {
            id: true,
            address: true,
            city: true,
            zip: true,
            listPrice: true,
            beds: true,
            baths: true,
            sqft: true,
            photoUrls: true,
            status: true,
          },
        },
      },
      orderBy: [{ score: "desc" }, { createdAt: "desc" }],
    });

    // Serialize dates and group by status
    const grouped: Record<string, unknown[]> = {};
    for (const stage of VALID_STAGES) {
      grouped[stage] = [];
    }

    for (const lead of leads) {
      const stage = lead.status || "new";
      const serialized = {
        ...lead,
        createdAt: lead.createdAt.toISOString(),
        updatedAt: lead.updatedAt.toISOString(),
        contactedAt: lead.contactedAt?.toISOString() ?? null,
        closedAt: lead.closedAt?.toISOString() ?? null,
      };
      if (grouped[stage]) {
        grouped[stage].push(serialized);
      } else {
        grouped.new.push(serialized);
      }
    }

    return NextResponse.json(grouped);
  } catch (err) {
    console.error("[CRM Pipeline GET]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * PATCH /api/leads/crm/pipeline
 *
 * Move a lead to a new pipeline stage (updates status field).
 * Body: { leadId, newStage }
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
    const { leadId, newStage } = body;

    if (!leadId || typeof leadId !== "string") {
      return NextResponse.json({ error: "leadId required" }, { status: 400 });
    }
    if (!newStage || !VALID_STAGES.includes(newStage)) {
      return NextResponse.json(
        { error: `Invalid stage. Must be one of: ${VALID_STAGES.join(", ")}` },
        { status: 400 }
      );
    }

    // Get current lead
    const existing = await prisma.lead.findUnique({
      where: { id: leadId },
      select: { status: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    // Update lead status
    const updated = await prisma.lead.update({
      where: { id: leadId },
      data: {
        status: newStage,
        ...(newStage === "contacted" && !existing.status?.includes("contacted")
          ? { contactedAt: new Date() }
          : {}),
        ...(newStage === "closed" ? { closedAt: new Date() } : {}),
      },
      include: {
        listing: {
          select: {
            id: true,
            address: true,
            city: true,
            zip: true,
            listPrice: true,
            beds: true,
            baths: true,
            sqft: true,
            photoUrls: true,
            status: true,
          },
        },
      },
    });

    return NextResponse.json({
      ...updated,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
      contactedAt: updated.contactedAt?.toISOString() ?? null,
      closedAt: updated.closedAt?.toISOString() ?? null,
    });
  } catch (err) {
    console.error("[CRM Pipeline PATCH]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
