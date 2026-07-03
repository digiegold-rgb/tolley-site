import { NextResponse } from "next/server";
import { requireVaterAdminApiSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { dollarsToCents } from "@/lib/budget/format";

export const dynamic = "force-dynamic";

async function ownedEntry(userId: string, id: string) {
  const entry = await prisma.budgetEntry.findUnique({ where: { id } });
  if (!entry || entry.userId !== userId) return null;
  return entry;
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireVaterAdminApiSession();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const existing = await ownedEntry(auth.session.userId, id);
  if (!existing) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const data: Record<string, unknown> = {};

  if (body.amount !== undefined) {
    const dollars = Number(body.amount);
    if (!Number.isFinite(dollars)) {
      return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
    }
    const cents = dollarsToCents(Math.abs(dollars));
    data.amountCents = body.kind === "income" ? cents : -Math.abs(cents);
  }
  if (body.amountCents !== undefined) {
    data.amountCents = Math.round(Number(body.amountCents));
  }
  if (body.categoryId !== undefined) {
    if (body.categoryId === null) {
      data.categoryId = null;
    } else {
      const owned = await prisma.budgetCategory.findFirst({
        where: { id: body.categoryId, userId: auth.session.userId },
      });
      if (!owned) return NextResponse.json({ error: "Bad categoryId" }, { status: 400 });
      data.categoryId = owned.id;
    }
  }
  if (typeof body.vendor === "string" || body.vendor === null) data.vendor = body.vendor;
  if (typeof body.note === "string" || body.note === null) data.note = body.note;
  if (Array.isArray(body.tags)) {
    data.tags = body.tags.map((t: unknown) => String(t).toLowerCase()).filter(Boolean);
  }
  if (body.occurredAt) data.occurredAt = new Date(body.occurredAt);
  if (typeof body.needsReview === "boolean") data.needsReview = body.needsReview;

  const entry = await prisma.budgetEntry.update({
    where: { id },
    data,
    include: {
      category: {
        select: { id: true, name: true, slug: true, color: true, icon: true },
      },
    },
  });
  return NextResponse.json({ ok: true, entry });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireVaterAdminApiSession();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const existing = await ownedEntry(auth.session.userId, id);
  if (!existing) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  await prisma.budgetEntry.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
