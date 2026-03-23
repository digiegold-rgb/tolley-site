// @ts-nocheck — references removed Prisma models
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/**
 * GET /api/leads/crm/deals
 *
 * List deals with optional stage filter.
 * Query params: stage (optional)
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

    const stage = request.nextUrl.searchParams.get("stage");

    const where: Record<string, unknown> = { subscriberId: sub.id };
    if (stage) where.stage = stage;

    const deals = await prisma.deal.findMany({
      where,
      include: {
        lead: { select: { id: true, ownerName: true } },
        client: { select: { id: true, firstName: true, lastName: true } },
        listing: { select: { id: true, address: true, listPrice: true } },
        _count: { select: { tasks: true } },
      },
      orderBy: { updatedAt: "desc" },
    });

    const serialized = deals.map((d) => ({
      ...d,
      offerDate: d.offerDate?.toISOString() ?? null,
      contractDate: d.contractDate?.toISOString() ?? null,
      inspectionDate: d.inspectionDate?.toISOString() ?? null,
      appraisalDate: d.appraisalDate?.toISOString() ?? null,
      closingDate: d.closingDate?.toISOString() ?? null,
      closedDate: d.closedDate?.toISOString() ?? null,
      createdAt: d.createdAt.toISOString(),
      updatedAt: d.updatedAt.toISOString(),
    }));

    return NextResponse.json({ deals: serialized });
  } catch (err) {
    console.error("[CRM Deals GET]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/leads/crm/deals
 *
 * Create a deal.
 * Body: { title, type?, leadId?, clientId?, listingId?, propertyAddress?, salePrice?, commissionPct?, commissionFlat?, referralFeePct?, stage? }
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
    const {
      title,
      type,
      leadId,
      clientId,
      listingId,
      propertyAddress,
      salePrice,
      commissionPct,
      commissionFlat,
      referralFeePct,
      stage,
    } = body;

    if (!title || typeof title !== "string" || title.trim().length === 0) {
      return NextResponse.json({ error: "Deal title is required" }, { status: 400 });
    }

    // Compute expected revenue
    let expectedRevenue: number | undefined;
    if (salePrice && commissionPct) {
      const referralMultiplier = (100 - (referralFeePct || 0)) / 100;
      expectedRevenue = salePrice * (commissionPct / 100) * referralMultiplier;
    } else if (commissionFlat) {
      const referralMultiplier = (100 - (referralFeePct || 0)) / 100;
      expectedRevenue = commissionFlat * referralMultiplier;
    }

    const deal = await prisma.deal.create({
      data: {
        subscriberId: sub.id,
        title: title.trim(),
        ...(type ? { type } : {}),
        ...(leadId ? { leadId } : {}),
        ...(clientId ? { clientId } : {}),
        ...(listingId ? { listingId } : {}),
        ...(propertyAddress ? { propertyAddress } : {}),
        ...(salePrice !== undefined ? { salePrice } : {}),
        ...(commissionPct !== undefined ? { commissionPct } : {}),
        ...(commissionFlat !== undefined ? { commissionFlat } : {}),
        ...(referralFeePct !== undefined ? { referralFeePct } : {}),
        ...(expectedRevenue !== undefined ? { expectedRevenue } : {}),
        ...(stage ? { stage } : {}),
      },
      include: {
        lead: { select: { id: true, ownerName: true } },
        client: { select: { id: true, firstName: true, lastName: true } },
        listing: { select: { id: true, address: true, listPrice: true } },
        _count: { select: { tasks: true } },
      },
    });

    // Log activity
    await prisma.crmActivity.create({
      data: {
        subscriberId: sub.id,
        ...(leadId ? { leadId } : {}),
        ...(clientId ? { clientId } : {}),
        dealId: deal.id,
        type: "deal_created",
        title: `Deal created: ${title.trim()}`,
        metadata: {
          dealType: type || "referral",
          ...(expectedRevenue !== undefined ? { expectedRevenue } : {}),
        },
      },
    });

    return NextResponse.json(
      {
        deal: {
          ...deal,
          offerDate: deal.offerDate?.toISOString() ?? null,
          contractDate: deal.contractDate?.toISOString() ?? null,
          inspectionDate: deal.inspectionDate?.toISOString() ?? null,
          appraisalDate: deal.appraisalDate?.toISOString() ?? null,
          closingDate: deal.closingDate?.toISOString() ?? null,
          closedDate: deal.closedDate?.toISOString() ?? null,
          createdAt: deal.createdAt.toISOString(),
          updatedAt: deal.updatedAt.toISOString(),
        },
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("[CRM Deals POST]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
