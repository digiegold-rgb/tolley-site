import { NextResponse } from "next/server";
import { requireVaterAdminApiSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { dollarsToCents } from "@/lib/budget/format";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

async function owned(userId: string, id: string) {
  const r = await prisma.budgetRecurring.findUnique({ where: { id } });
  if (!r || r.userId !== userId) return null;
  return r;
}

export async function PATCH(req: Request, { params }: RouteContext) {
  const auth = await requireVaterAdminApiSession();
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const existing = await owned(auth.session.userId, id);
  if (!existing) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const data: Record<string, unknown> = {};
  if (typeof body.name === "string") data.name = body.name.trim();
  if (body.amount !== undefined) data.amountCents = dollarsToCents(Number(body.amount));
  if (body.amountCents !== undefined) data.amountCents = Math.round(Number(body.amountCents));
  if (typeof body.cadence === "string") data.cadence = body.cadence.toLowerCase();
  if (body.dayOfMonth !== undefined) data.dayOfMonth = body.dayOfMonth === null ? null : Number(body.dayOfMonth);
  if (body.nextDueAt) data.nextDueAt = new Date(body.nextDueAt);
  if (typeof body.active === "boolean") data.active = body.active;
  if (body.categoryId !== undefined) {
    if (body.categoryId === null) {
      data.categoryId = null;
    } else {
      const owned = await prisma.budgetCategory.findFirst({
        where: { id: body.categoryId, userId: auth.session.userId },
      });
      data.categoryId = owned?.id ?? null;
    }
  }

  const rec = await prisma.budgetRecurring.update({ where: { id }, data });
  return NextResponse.json({ ok: true, recurring: rec });
}

export async function DELETE(_req: Request, { params }: RouteContext) {
  const auth = await requireVaterAdminApiSession();
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const existing = await owned(auth.session.userId, id);
  if (!existing) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  await prisma.budgetRecurring.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
