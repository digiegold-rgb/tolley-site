import { NextResponse } from "next/server";
import { requireVaterAdminApiSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { dollarsToCents } from "@/lib/budget/format";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireVaterAdminApiSession();
  if (!auth.ok) return auth.response;
  const goals = await prisma.budgetGoal.findMany({
    where: { userId: auth.session.userId },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ goals });
}

export async function POST(req: Request) {
  const auth = await requireVaterAdminApiSession();
  if (!auth.ok) return auth.response;
  const body = await req.json().catch(() => ({}));
  const name = String(body.name || "").trim();
  if (!name) return NextResponse.json({ error: "Missing name" }, { status: 400 });
  const target = Number(body.target ?? body.targetCents);
  if (!Number.isFinite(target) || target <= 0) {
    return NextResponse.json({ error: "Invalid target" }, { status: 400 });
  }
  const targetCents = body.targetCents !== undefined ? Math.round(Number(body.targetCents)) : dollarsToCents(target);
  const currentCents = body.currentCents !== undefined
    ? Math.round(Number(body.currentCents))
    : body.current !== undefined
      ? dollarsToCents(Number(body.current))
      : 0;
  const goal = await prisma.budgetGoal.create({
    data: {
      userId: auth.session.userId,
      name,
      targetCents,
      currentCents,
      targetDate: body.targetDate ? new Date(body.targetDate) : null,
    },
  });
  return NextResponse.json({ ok: true, goal }, { status: 201 });
}
