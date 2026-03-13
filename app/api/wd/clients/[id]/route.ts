import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateWdAdmin } from "@/lib/wd-auth";
import { del } from "@vercel/blob";

// PATCH /api/wd/clients/[id]
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { authed, role } = await validateWdAdmin();
  if (!authed || !role) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const existing = await prisma.wdClient.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Keagan cannot edit locked rows
    if (existing.locked && role === "keegan") {
      return NextResponse.json({ error: "This client is locked" }, { status: 403 });
    }

    const body = await request.json();
    const data: Record<string, unknown> = {};

    // Fields Keagan cannot change
    const adminOnlyFields = ["blockedFields", "locked", "stripeCustomerId"];
    const blockedForKeagan = existing.blockedFields;

    for (const [key, value] of Object.entries(body)) {
      // Keagan restrictions
      if (role === "keegan") {
        if (adminOnlyFields.includes(key)) continue;
        if (blockedForKeagan.includes(key)) continue;
      }

      if (key === "installDate" && value) {
        data[key] = new Date(value as string);
      } else {
        data[key] = value;
      }
    }

    const updated = await prisma.wdClient.update({
      where: { id },
      data,
      include: { payments: true },
    });

    return NextResponse.json(updated);
  } catch (err) {
    console.error("[wd/clients PATCH]", err);
    return NextResponse.json({ error: "Update failed" }, { status: 400 });
  }
}

// DELETE /api/wd/clients/[id] — Tolley only
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { authed, role } = await validateWdAdmin();
  if (!authed || !role) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (role !== "tolley") {
    return NextResponse.json({ error: "Only Tolley can delete clients" }, { status: 403 });
  }

  const { id } = await params;

  try {
    const client = await prisma.wdClient.findUnique({ where: { id } });
    if (!client) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Delete blob photos/receipts
    for (const url of [...client.photoUrls, ...client.receiptUrls]) {
      try { await del(url); } catch { /* blob may be gone */ }
    }

    await prisma.wdClient.delete({ where: { id } });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[wd/clients DELETE]", err);
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }
}
