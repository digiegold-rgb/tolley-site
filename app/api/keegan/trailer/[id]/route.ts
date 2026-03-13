import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateWdAdmin } from "@/lib/wd-auth";

// PATCH /api/keegan/trailer/[id]
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { authed } = await validateWdAdmin();
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();

  try {
    if (body.installDate) {
      body.installDate = new Date(body.installDate);
    }
    const client = await prisma.trailerClient.update({
      where: { id },
      data: body,
      include: { payments: true },
    });
    return NextResponse.json(client);
  } catch {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }
}

// DELETE /api/keegan/trailer/[id] — Tolley only
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { authed, role } = await validateWdAdmin();
  if (!authed || role !== "tolley") {
    return NextResponse.json({ error: "Only Tolley can delete trailer clients" }, { status: 403 });
  }

  const { id } = await params;

  try {
    await prisma.trailerClient.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }
}
