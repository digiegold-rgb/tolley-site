/**
 * GET  /api/unclaimed/claim/[id] — View claim details
 * PATCH /api/unclaimed/claim/[id] — Update claim status/details
 */

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "LOGIN_REQUIRED" }, { status: 401 });
  }

  const { id } = await params;

  const claim = await prisma.unclaimedFundClaim.findUnique({
    where: { id },
    include: {
      fund: {
        include: { scan: true },
      },
    },
  });

  if (!claim) {
    return NextResponse.json({ error: "Claim not found" }, { status: 404 });
  }

  if (claim.fund.scan.userId !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({ claim });
}

const VALID_TRANSITIONS: Record<string, string[]> = {
  identified: ["contacted"],
  contacted: ["agreement_signed", "identified"], // can go back
  agreement_signed: ["filed"],
  filed: ["approved"],
  approved: ["paid"],
};

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "LOGIN_REQUIRED" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();

  const claim = await prisma.unclaimedFundClaim.findUnique({
    where: { id },
    include: { fund: { include: { scan: true } } },
  });

  if (!claim) {
    return NextResponse.json({ error: "Claim not found" }, { status: 404 });
  }

  if (claim.fund.scan.userId !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Build update data
  const update: Record<string, unknown> = {};

  // Status transition
  if (body.status) {
    const allowed = VALID_TRANSITIONS[claim.status] || [];
    if (!allowed.includes(body.status)) {
      return NextResponse.json(
        {
          error: `Cannot transition from "${claim.status}" to "${body.status}". Allowed: ${allowed.join(", ")}`,
        },
        { status: 400 }
      );
    }
    update.status = body.status;

    // Auto-set timestamps
    if (body.status === "agreement_signed") update.agreementSignedAt = new Date();
    if (body.status === "filed") update.filedAt = new Date();
    if (body.status === "approved") update.approvedAt = new Date();
    if (body.status === "paid") update.paidAt = new Date();
  }

  // Editable fields
  if (body.ownerPhone !== undefined) update.ownerPhone = body.ownerPhone;
  if (body.ownerEmail !== undefined) update.ownerEmail = body.ownerEmail;
  if (body.ownerAddress !== undefined) update.ownerAddress = body.ownerAddress;
  if (body.agreedFeePercent !== undefined)
    update.agreedFeePercent = body.agreedFeePercent;
  if (body.expectedFee !== undefined) update.expectedFee = body.expectedFee;
  if (body.actualPayout !== undefined) update.actualPayout = body.actualPayout;
  if (body.notes !== undefined) update.notes = body.notes;

  const updated = await prisma.unclaimedFundClaim.update({
    where: { id },
    data: update,
  });

  return NextResponse.json({ ok: true, claim: updated });
}
