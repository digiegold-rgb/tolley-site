import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { validateWdAdmin } from "@/lib/wd-auth";
import { isHqStage } from "@/lib/hq";

export const runtime = "nodejs";

// GET /api/hq/leads?stage=scraped&offer=site — pipeline board data.
// Touches ride along (newest first) so the detail drawer is instant.
export async function GET(request: NextRequest) {
  const { authed } = await validateWdAdmin();
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const stage = searchParams.get("stage");
  const offer = searchParams.get("offer");

  const where: Record<string, unknown> = {};
  if (stage && isHqStage(stage)) where.stage = stage;
  if (offer) where.offer = offer;

  try {
    const leads = await prisma.growthLead.findMany({
      where,
      include: { touches: { orderBy: { createdAt: "desc" } } },
      orderBy: [{ score: { sort: "desc", nulls: "last" } }, { updatedAt: "desc" }],
    });

    return NextResponse.json({ leads });
  } catch (err) {
    console.error("[hq/leads GET]", err);
    return NextResponse.json({ error: "Failed to load leads" }, { status: 500 });
  }
}
