/**
 * PATCH /api/vater/arbitrage/[id] — Transition arbitrage pair status
 */

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const VALID_TRANSITIONS: Record<string, string[]> = {
  pending: ["approved", "rejected"],
  approved: ["listed", "rejected"],
  rejected: ["pending"],
};

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "LOGIN_REQUIRED" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();

  const pair = await prisma.arbitragePair.findUnique({ where: { id } });

  if (!pair) {
    return NextResponse.json({ error: "Pair not found" }, { status: 404 });
  }

  if (!body.status) {
    return NextResponse.json({ error: "Missing status" }, { status: 400 });
  }

  const allowed = VALID_TRANSITIONS[pair.status] || [];
  if (!allowed.includes(body.status)) {
    return NextResponse.json(
      {
        error: `Cannot transition from "${pair.status}" to "${body.status}". Allowed: ${allowed.join(", ")}`,
      },
      { status: 400 }
    );
  }

  const update: Record<string, unknown> = { status: body.status };

  // Auto-set timestamps
  if (body.status === "approved") update.approvedAt = new Date();
  if (body.status === "rejected") update.rejectedAt = new Date();
  if (body.status === "listed") update.listedAt = new Date();

  if (body.notes !== undefined) update.notes = body.notes;

  const updated = await prisma.arbitragePair.update({
    where: { id },
    data: update,
  });

  return NextResponse.json({ ok: true, pair: updated });
}
