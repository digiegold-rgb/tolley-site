import { NextResponse } from "next/server";
import { requireVaterAdminApiSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { dollarsToCents, slugify } from "@/lib/budget/format";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireVaterAdminApiSession();
  if (!auth.ok) return auth.response;

  const categories = await prisma.budgetCategory.findMany({
    where: { userId: auth.session.userId },
    orderBy: [{ archived: "asc" }, { sortOrder: "asc" }],
  });
  return NextResponse.json({ categories });
}

export async function POST(req: Request) {
  const auth = await requireVaterAdminApiSession();
  if (!auth.ok) return auth.response;

  const body = await req.json().catch(() => ({}));
  const name = String(body.name || "").trim();
  if (!name) {
    return NextResponse.json({ error: "Missing name" }, { status: 400 });
  }
  const slug = body.slug ? slugify(String(body.slug)) : slugify(name);
  if (!slug) {
    return NextResponse.json({ error: "Invalid slug" }, { status: 400 });
  }

  const monthlyLimitCents =
    body.monthlyLimitCents !== undefined
      ? Number(body.monthlyLimitCents)
      : dollarsToCents(body.monthlyLimit ?? 0);

  const category = await prisma.budgetCategory.create({
    data: {
      userId: auth.session.userId,
      name,
      slug,
      monthlyLimitCents: Math.max(0, Math.round(monthlyLimitCents)),
      color: body.color || "#38bdf8",
      icon: body.icon || null,
      sortOrder: Number.isFinite(body.sortOrder) ? Number(body.sortOrder) : 999,
    },
  });

  return NextResponse.json({ ok: true, category }, { status: 201 });
}
