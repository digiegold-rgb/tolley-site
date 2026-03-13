import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateWdAdmin } from "@/lib/wd-auth";

// GET /api/keagan/payments?category=wd&status=paid
export async function GET(request: NextRequest) {
  const { authed } = await validateWdAdmin();
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category");
  const status = searchParams.get("status");

  const where: Record<string, unknown> = {};
  if (category) where.category = category;
  if (status) where.status = status;

  const payments = await prisma.partnerPayment.findMany({
    where,
    orderBy: { date: "desc" },
  });

  return NextResponse.json({ payments });
}

// POST /api/keagan/payments — Tolley only
export async function POST(request: NextRequest) {
  const { authed, role } = await validateWdAdmin();
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (role !== "tolley") {
    return NextResponse.json({ error: "Only Tolley can add payments" }, { status: 403 });
  }

  const { amount, date, description, category, status } = await request.json();

  if (typeof amount !== "number" || amount <= 0) {
    return NextResponse.json({ error: "Valid amount required" }, { status: 400 });
  }
  if (!description?.trim()) {
    return NextResponse.json({ error: "Description required" }, { status: 400 });
  }
  if (!["wd", "trailer", "labor", "other"].includes(category)) {
    return NextResponse.json({ error: "Invalid category" }, { status: 400 });
  }

  const payment = await prisma.partnerPayment.create({
    data: {
      amount,
      date: new Date(date),
      description: description.trim(),
      category,
      status: status || "paid",
    },
  });

  return NextResponse.json(payment, { status: 201 });
}
