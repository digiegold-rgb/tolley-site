import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateShopAdmin } from "@/lib/shop-auth";
import { promoteDistressSignal } from "@/lib/serpapi/promote-to-lead";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await validateShopAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const data: { status?: string; notes?: string } = {};
  if (typeof body.status === "string") data.status = body.status;
  if (typeof body.notes === "string") data.notes = body.notes;

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  // See the probate handler — promotion must create the Lead, not just set a
  // status string. Idempotent via the signal's leadId back-link.
  if (data.status === "promoted") {
    if (typeof data.notes === "string") {
      await prisma.distressSignal.update({ where: { id }, data: { notes: data.notes } });
    }
    const result = await promoteDistressSignal(id);
    if (!result.ok) {
      return NextResponse.json({ error: result.error ?? "Promotion failed" }, { status: 500 });
    }
    const signal = await prisma.distressSignal.findUnique({ where: { id } });
    return NextResponse.json({ signal, leadId: result.leadId, deduped: result.deduped ?? false });
  }

  const updated = await prisma.distressSignal.update({ where: { id }, data });
  return NextResponse.json({ signal: updated });
}
