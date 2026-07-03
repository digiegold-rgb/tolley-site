import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireVaterAdminApiSession } from "@/lib/admin-auth";

export const runtime = "nodejs";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const adminCheck = await requireVaterAdminApiSession();
  if (!adminCheck.ok) return adminCheck.response;

  const { id } = await params;
  const proposal = await prisma.vaterObserverProposal.findUnique({
    where: { id },
  });
  if (!proposal) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (proposal.status !== "pending") {
    return NextResponse.json(
      { error: `Already ${proposal.status}` },
      { status: 409 },
    );
  }

  const updated = await prisma.vaterObserverProposal.update({
    where: { id },
    data: {
      status: "dismissed",
      resolvedAt: new Date(),
    },
  });
  return NextResponse.json({ id: updated.id, status: updated.status });
}
