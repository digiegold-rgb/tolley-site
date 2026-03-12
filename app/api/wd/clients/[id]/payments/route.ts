import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateWdAdmin } from "@/lib/wd-auth";

// POST /api/wd/clients/[id]/payments — add payment
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { authed } = await validateWdAdmin();
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const { amount, month, note } = await request.json();

    if (typeof amount !== "number" || amount <= 0) {
      return NextResponse.json({ error: "Valid amount required" }, { status: 400 });
    }
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return NextResponse.json({ error: "Month must be YYYY-MM format" }, { status: 400 });
    }

    // Verify client exists
    const client = await prisma.wdClient.findUnique({ where: { id } });
    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    const payment = await prisma.wdPayment.create({
      data: {
        clientId: id,
        amount,
        month,
        note: note?.trim() || null,
      },
    });

    return NextResponse.json(payment, { status: 201 });
  } catch (err) {
    console.error("[wd/payments POST]", err);
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
}

// DELETE /api/wd/clients/[id]/payments?paymentId=xxx — Tolley only
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { authed, role } = await validateWdAdmin();
  if (!authed || !role) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (role !== "tolley") {
    return NextResponse.json({ error: "Only Tolley can delete payments" }, { status: 403 });
  }

  await params; // consume params
  const paymentId = new URL(request.url).searchParams.get("paymentId");
  if (!paymentId) {
    return NextResponse.json({ error: "paymentId required" }, { status: 400 });
  }

  try {
    await prisma.wdPayment.delete({ where: { id: paymentId } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Payment not found" }, { status: 404 });
  }
}
