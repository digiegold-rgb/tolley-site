import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateWdAdmin } from "@/lib/wd-auth";

// GET /api/keagan/trailer
export async function GET() {
  const { authed } = await validateWdAdmin();
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const clients = await prisma.trailerClient.findMany({
    include: { payments: true },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ clients });
}

// POST /api/keagan/trailer — add trailer client
export async function POST(request: NextRequest) {
  const { authed, role } = await validateWdAdmin();
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (role !== "tolley") {
    return NextResponse.json({ error: "Only Tolley can add trailer clients" }, { status: 403 });
  }

  const body = await request.json();
  const { name, trailerDescription, monthlyCost, investmentCost, address, phone, email, notes, installDate } = body;

  if (!name?.trim() || !trailerDescription?.trim()) {
    return NextResponse.json({ error: "Name and trailer description required" }, { status: 400 });
  }

  const client = await prisma.trailerClient.create({
    data: {
      name: name.trim(),
      trailerDescription: trailerDescription.trim(),
      monthlyCost: monthlyCost ?? 0,
      investmentCost: investmentCost ?? 0,
      address: address || null,
      phone: phone || null,
      email: email || null,
      notes: notes || null,
      installDate: installDate ? new Date(installDate) : null,
    },
  });

  return NextResponse.json(client, { status: 201 });
}
