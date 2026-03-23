// @ts-nocheck — references removed Prisma models
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/leads/crm/deals/[id]
 *
 * Get a single deal with all details.
 */
export async function GET(
  _request: NextRequest,
  context: RouteContext
) {
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

    const { id } = await context.params;

    const deal = await prisma.deal.findUnique({
      where: { id },
      include: {
        lead: {
          select: {
            id: true,
            ownerName: true,
            ownerPhone: true,
            ownerEmail: true,
            score: true,
            status: true,
            listing: {
              select: { address: true, city: true, zip: true, listPrice: true },
            },
          },
        },
        client: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
          },
        },
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
        tasks: {
          orderBy: { dueDate: "asc" },
        },
        activities: {
          orderBy: { createdAt: "desc" },
          take: 20,
        },
      },
    });

    if (!deal || deal.subscriberId !== sub.id) {
      return NextResponse.json({ error: "Deal not found" }, { status: 404 });
    }

    return NextResponse.json({
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
        tasks: deal.tasks.map((t) => ({
          ...t,
          dueDate: t.dueDate?.toISOString() ?? null,
          completedAt: t.completedAt?.toISOString() ?? null,
          createdAt: t.createdAt.toISOString(),
          updatedAt: t.updatedAt.toISOString(),
        })),
        activities: deal.activities.map((a) => ({
          ...a,
          createdAt: a.createdAt.toISOString(),
        })),
      },
    });
  } catch (err) {
    console.error("[CRM Deal GET]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * PATCH /api/leads/crm/deals/[id]
 *
 * Update a deal.
 * Body: partial deal fields
 */
export async function PATCH(
  request: NextRequest,
  context: RouteContext
) {
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

    const { id } = await context.params;

    // Verify ownership
    const existing = await prisma.deal.findUnique({ where: { id } });
    if (!existing || existing.subscriberId !== sub.id) {
      return NextResponse.json({ error: "Deal not found" }, { status: 404 });
    }

    const body = await request.json();

    // Build update data — only allowed fields
    const allowed = [
      "title", "type", "stage", "leadId", "clientId", "listingId",
      "propertyAddress", "salePrice", "commissionPct", "commissionFlat",
      "referralFeePct", "expectedRevenue", "actualRevenue",
      "offerDate", "contractDate", "inspectionDate", "appraisalDate",
      "closingDate", "closedDate", "buyerName", "sellerName",
      "referredTo", "referredFrom", "lenderName", "titleCompany", "notes",
    ];

    const dateFields = [
      "offerDate", "contractDate", "inspectionDate", "appraisalDate",
      "closingDate", "closedDate",
    ];

    const data: Record<string, unknown> = {};
    for (const key of allowed) {
      if (key in body) {
        if (dateFields.includes(key)) {
          data[key] = body[key] ? new Date(body[key]) : null;
        } else {
          data[key] = body[key];
        }
      }
    }

    // Recompute expectedRevenue if price/commission changed
    const salePrice = body.salePrice ?? existing.salePrice;
    const commissionPct = body.commissionPct ?? existing.commissionPct;
    const referralFeePct = body.referralFeePct ?? existing.referralFeePct;
    if (
      (body.salePrice !== undefined || body.commissionPct !== undefined || body.referralFeePct !== undefined) &&
      salePrice && commissionPct
    ) {
      const referralMultiplier = (100 - (referralFeePct || 0)) / 100;
      data.expectedRevenue = salePrice * (commissionPct / 100) * referralMultiplier;
    }

    const deal = await prisma.deal.update({
      where: { id },
      data,
      include: {
        lead: { select: { id: true, ownerName: true } },
        client: { select: { id: true, firstName: true, lastName: true } },
        listing: { select: { id: true, address: true, listPrice: true } },
        _count: { select: { tasks: true } },
      },
    });

    // Log stage change
    if (body.stage && body.stage !== existing.stage) {
      await prisma.crmActivity.create({
        data: {
          subscriberId: sub.id,
          dealId: id,
          ...(deal.leadId ? { leadId: deal.leadId } : {}),
          ...(deal.clientId ? { clientId: deal.clientId } : {}),
          type: "deal_stage_change",
          title: `Deal moved to ${body.stage}`,
          metadata: { from: existing.stage, to: body.stage },
        },
      });
    }

    return NextResponse.json({
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
    });
  } catch (err) {
    console.error("[CRM Deal PATCH]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * DELETE /api/leads/crm/deals/[id]
 *
 * Soft delete a deal (set stage to "fell_through").
 */
export async function DELETE(
  _request: NextRequest,
  context: RouteContext
) {
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

    const { id } = await context.params;

    // Verify ownership
    const existing = await prisma.deal.findUnique({ where: { id } });
    if (!existing || existing.subscriberId !== sub.id) {
      return NextResponse.json({ error: "Deal not found" }, { status: 404 });
    }

    await prisma.deal.update({
      where: { id },
      data: { stage: "fell_through" },
    });

    // Log activity
    await prisma.crmActivity.create({
      data: {
        subscriberId: sub.id,
        dealId: id,
        ...(existing.leadId ? { leadId: existing.leadId } : {}),
        ...(existing.clientId ? { clientId: existing.clientId } : {}),
        type: "deal_stage_change",
        title: "Deal marked as fell through",
        metadata: { from: existing.stage, to: "fell_through" },
      },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[CRM Deal DELETE]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
