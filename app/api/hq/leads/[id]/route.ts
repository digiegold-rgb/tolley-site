import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { validateWdAdmin } from "@/lib/wd-auth";
import { sanitizeGrowthLeadInput } from "@/lib/hq";

export const runtime = "nodejs";

// PATCH /api/hq/leads/[id] — update stage/notes/email/etc on a lead.
// Only whitelisted GrowthLead scalar fields are accepted (lib/hq).
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { authed } = await validateWdAdmin();
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const existing = await prisma.growthLead.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const body = await request.json();
    const data = sanitizeGrowthLeadInput(body);

    if ("stage" in body && !("stage" in data)) {
      return NextResponse.json({ error: "Invalid stage" }, { status: 400 });
    }
    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    const updated = await prisma.growthLead.update({
      where: { id },
      data,
      include: { touches: { orderBy: { createdAt: "desc" } } },
    });

    return NextResponse.json({ lead: updated });
  } catch (err) {
    console.error("[hq/leads PATCH]", err);
    return NextResponse.json({ error: "Update failed" }, { status: 400 });
  }
}
