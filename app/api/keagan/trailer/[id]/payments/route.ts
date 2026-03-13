import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateWdAdmin } from "@/lib/wd-auth";

// POST /api/keagan/trailer/[id]/payments — add payment
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { authed } = await validateWdAdmin();
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const { amount, month, note, status } = await request.json();

  if (typeof amount !== "number" || amount <= 0) {
    return NextResponse.json({ error: "Valid amount required" }, { status: 400 });
  }
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: "Month must be YYYY-MM format" }, { status: 400 });
  }

  const client = await prisma.trailerClient.findUnique({ where: { id } });
  if (!client) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  const payment = await prisma.trailerPayment.create({
    data: {
      clientId: id,
      amount,
      month,
      status: status || "paid",
      note: note?.trim() || null,
    },
  });

  return NextResponse.json(payment, { status: 201 });
}

// PATCH /api/keagan/trailer/[id]/payments?paymentId=xxx — update status
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { authed } = await validateWdAdmin();
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await params;
  const paymentId = new URL(request.url).searchParams.get("paymentId");
  if (!paymentId) {
    return NextResponse.json({ error: "paymentId required" }, { status: 400 });
  }

  const { status } = await request.json();
  if (!["paid", "late", "missed"].includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const payment = await prisma.trailerPayment.update({
    where: { id: paymentId },
    data: { status },
  });
  return NextResponse.json(payment);
}

// DELETE /api/keagan/trailer/[id]/payments?paymentId=xxx — Tolley only
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { authed, role } = await validateWdAdmin();
  if (!authed || role !== "tolley") {
    return NextResponse.json({ error: "Only Tolley can delete payments" }, { status: 403 });
  }

  await params;
  const paymentId = new URL(request.url).searchParams.get("paymentId");
  if (!paymentId) {
    return NextResponse.json({ error: "paymentId required" }, { status: 400 });
  }

  await prisma.trailerPayment.delete({ where: { id: paymentId } });
  return NextResponse.json({ ok: true });
}
