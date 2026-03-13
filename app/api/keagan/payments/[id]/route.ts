import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateWdAdmin } from "@/lib/wd-auth";

// PATCH /api/keagan/payments/[id]
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { authed, role } = await validateWdAdmin();
  if (!authed || role !== "tolley") {
    return NextResponse.json({ error: "Only Tolley can update payments" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();

  try {
    const payment = await prisma.partnerPayment.update({
      where: { id },
      data: body,
    });
    return NextResponse.json(payment);
  } catch {
    return NextResponse.json({ error: "Payment not found" }, { status: 404 });
  }
}

// DELETE /api/keagan/payments/[id]
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { authed, role } = await validateWdAdmin();
  if (!authed || role !== "tolley") {
    return NextResponse.json({ error: "Only Tolley can delete payments" }, { status: 403 });
  }

  const { id } = await params;

  try {
    await prisma.partnerPayment.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Payment not found" }, { status: 404 });
  }
}
