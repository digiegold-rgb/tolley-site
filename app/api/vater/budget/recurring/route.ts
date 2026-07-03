import { NextResponse } from "next/server";
import { requireVaterAdminApiSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { dollarsToCents } from "@/lib/budget/format";

export const dynamic = "force-dynamic";

const VALID_CADENCE = new Set(["monthly", "weekly", "yearly"]);

export async function GET() {
  const auth = await requireVaterAdminApiSession();
  if (!auth.ok) return auth.response;
  const recurring = await prisma.budgetRecurring.findMany({
    where: { userId: auth.session.userId },
    orderBy: [{ active: "desc" }, { nextDueAt: "asc" }],
    include: { category: { select: { id: true, name: true, color: true, icon: true } } },
  });
  return NextResponse.json({ recurring });
}

export async function POST(req: Request) {
  const auth = await requireVaterAdminApiSession();
  if (!auth.ok) return auth.response;
  const body = await req.json().catch(() => ({}));
  const name = String(body.name || "").trim();
  if (!name) return NextResponse.json({ error: "Missing name" }, { status: 400 });
  const cadence = String(body.cadence || "monthly").toLowerCase();
  if (!VALID_CADENCE.has(cadence)) {
    return NextResponse.json({ error: "Invalid cadence" }, { status: 400 });
  }
  const amountCents = body.amountCents !== undefined
    ? Math.round(Number(body.amountCents))
    : dollarsToCents(Number(body.amount));
  if (!Number.isFinite(amountCents) || amountCents <= 0) {
    return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
  }

  let categoryId: string | null = null;
  if (body.categoryId) {
    const owned = await prisma.budgetCategory.findFirst({
      where: { id: body.categoryId, userId: auth.session.userId },
    });
    categoryId = owned?.id ?? null;
  }

  const nextDueAt = body.nextDueAt ? new Date(body.nextDueAt) : new Date();

  const rec = await prisma.budgetRecurring.create({
    data: {
      userId: auth.session.userId,
      name,
      amountCents,
      cadence,
      dayOfMonth: cadence === "monthly" ? Number(body.dayOfMonth ?? nextDueAt.getDate()) : null,
      categoryId,
      nextDueAt,
    },
  });
  return NextResponse.json({ ok: true, recurring: rec }, { status: 201 });
}
