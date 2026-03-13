import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateWdAdmin } from "@/lib/wd-auth";

// GET /api/wd/repairs — list all repair items
export async function GET() {
  const { authed } = await validateWdAdmin();
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const items = await prisma.wdRepairItem.findMany({
    orderBy: { name: "asc" },
  });
  return NextResponse.json(items);
}

// POST /api/wd/repairs — add repair item (Tolley only)
export async function POST(request: NextRequest) {
  const { authed, role } = await validateWdAdmin();
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (role !== "tolley") {
    return NextResponse.json({ error: "Only Tolley can manage repairs" }, { status: 403 });
  }

  const { name, cost } = await request.json();
  if (!name?.trim() || typeof cost !== "number") {
    return NextResponse.json({ error: "name and cost required" }, { status: 400 });
  }

  const item = await prisma.wdRepairItem.create({
    data: { name: name.trim(), cost },
  });
  return NextResponse.json(item, { status: 201 });
}

// PATCH /api/wd/repairs?id=xxx — update repair item
export async function PATCH(request: NextRequest) {
  const { authed, role } = await validateWdAdmin();
  if (!authed || role !== "tolley") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const id = new URL(request.url).searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const { name, cost } = await request.json();
  const item = await prisma.wdRepairItem.update({
    where: { id },
    data: { name, cost },
  });
  return NextResponse.json(item);
}

// DELETE /api/wd/repairs?id=xxx — delete repair item
export async function DELETE(request: NextRequest) {
  const { authed, role } = await validateWdAdmin();
  if (!authed || role !== "tolley") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const id = new URL(request.url).searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  await prisma.wdRepairItem.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
