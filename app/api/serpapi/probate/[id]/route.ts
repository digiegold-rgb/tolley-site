import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateShopAdmin } from "@/lib/shop-auth";
import { promoteProbateSignal } from "@/lib/serpapi/promote-to-lead";

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

  // Promoting is the point of this table — it has to land a Lead in the CRM,
  // not just flip a string. promoteProbateSignal sets status itself and is
  // idempotent, so re-promoting an already-promoted signal is a no-op.
  if (data.status === "promoted") {
    if (typeof data.notes === "string") {
      await prisma.probateSignal.update({ where: { id }, data: { notes: data.notes } });
    }
    const result = await promoteProbateSignal(id);
    if (!result.ok) {
      return NextResponse.json({ error: result.error ?? "Promotion failed" }, { status: 500 });
    }
    const signal = await prisma.probateSignal.findUnique({ where: { id } });
    return NextResponse.json({ signal, leadId: result.leadId, deduped: result.deduped ?? false });
  }

  const updated = await prisma.probateSignal.update({
    where: { id },
    data,
  });

  return NextResponse.json({ signal: updated });
}
