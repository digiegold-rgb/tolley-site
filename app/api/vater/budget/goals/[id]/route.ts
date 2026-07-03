import { NextResponse } from "next/server";
import { requireVaterAdminApiSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { dollarsToCents } from "@/lib/budget/format";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

async function ownedGoal(userId: string, id: string) {
  const g = await prisma.budgetGoal.findUnique({ where: { id } });
  if (!g || g.userId !== userId) return null;
  return g;
}

export async function PATCH(req: Request, { params }: RouteContext) {
  const auth = await requireVaterAdminApiSession();
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const existing = await ownedGoal(auth.session.userId, id);
  if (!existing) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const data: Record<string, unknown> = {};
  if (typeof body.name === "string") data.name = body.name.trim();
  if (body.target !== undefined) data.targetCents = dollarsToCents(Number(body.target));
  if (body.targetCents !== undefined) data.targetCents = Math.round(Number(body.targetCents));
  if (body.current !== undefined) data.currentCents = dollarsToCents(Number(body.current));
  if (body.currentCents !== undefined) data.currentCents = Math.round(Number(body.currentCents));
  if (body.targetDate !== undefined) {
    data.targetDate = body.targetDate ? new Date(body.targetDate) : null;
  }
  if (typeof body.contribute === "number") {
    data.currentCents = existing.currentCents + dollarsToCents(body.contribute);
  }

  const goal = await prisma.budgetGoal.update({ where: { id }, data });
  return NextResponse.json({ ok: true, goal });
}

export async function DELETE(_req: Request, { params }: RouteContext) {
  const auth = await requireVaterAdminApiSession();
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const existing = await ownedGoal(auth.session.userId, id);
  if (!existing) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  await prisma.budgetGoal.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
