import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateWdAdmin } from "@/lib/wd-auth";
import { computeRevenueSplit } from "@/lib/wd";

// GET /api/wd/clients?source=tolley&active=true
export async function GET(request: NextRequest) {
  const { authed, role } = await validateWdAdmin();
  if (!authed || !role) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const source = searchParams.get("source");
  const active = searchParams.get("active");

  const where: Record<string, unknown> = {};
  if (source) where.source = source;
  if (active !== null) where.active = active === "true";

  const clients = await prisma.wdClient.findMany({
    where,
    include: { payments: true },
    orderBy: { name: "asc" },
  });

  const result = clients.map((c) => {
    const split = computeRevenueSplit(c);
    return { ...c, split };
  });

  return NextResponse.json({ clients: result, role });
}

// POST /api/wd/clients — create new client
export async function POST(request: NextRequest) {
  const { authed } = await validateWdAdmin();
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const {
      name, address, phone, email, unitDescription, unitCost,
      installDate, notes, photoUrls, receiptUrls, source, paidBy,
    } = body;

    if (!name || !unitDescription) {
      return NextResponse.json({ error: "Name and unit description required" }, { status: 400 });
    }

    const client = await prisma.wdClient.create({
      data: {
        name: name.trim(),
        address: address?.trim() || null,
        phone: phone?.trim() || null,
        email: email?.trim() || null,
        unitDescription: unitDescription.trim(),
        unitCost: unitCost ?? 200,
        installDate: installDate ? new Date(installDate) : null,
        notes: notes?.trim() || null,
        photoUrls: photoUrls || [],
        receiptUrls: receiptUrls || [],
        source: source || "tolley",
        paidBy: paidBy || "tolley",
      },
    });

    return NextResponse.json(client, { status: 201 });
  } catch (err) {
    console.error("[wd/clients POST]", err);
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
}
