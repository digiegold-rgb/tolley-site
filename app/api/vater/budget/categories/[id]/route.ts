import { NextResponse } from "next/server";
import { requireVaterAdminApiSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { dollarsToCents, slugify } from "@/lib/budget/format";

export const dynamic = "force-dynamic";

async function ownedCategory(userId: string, id: string) {
  const cat = await prisma.budgetCategory.findUnique({ where: { id } });
  if (!cat || cat.userId !== userId) return null;
  return cat;
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireVaterAdminApiSession();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const cat = await ownedCategory(auth.session.userId, id);
  if (!cat) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const data: Record<string, unknown> = {};
  if (typeof body.name === "string") data.name = body.name.trim();
  if (typeof body.slug === "string") data.slug = slugify(body.slug);
  if (body.monthlyLimit !== undefined) {
    data.monthlyLimitCents = Math.max(0, Math.round(dollarsToCents(body.monthlyLimit)));
  }
  if (body.monthlyLimitCents !== undefined) {
    data.monthlyLimitCents = Math.max(0, Math.round(Number(body.monthlyLimitCents)));
  }
  if (typeof body.color === "string") data.color = body.color;
  if (typeof body.icon === "string" || body.icon === null) data.icon = body.icon;
  if (typeof body.archived === "boolean") data.archived = body.archived;
  if (Number.isFinite(body.sortOrder)) data.sortOrder = Number(body.sortOrder);

  const category = await prisma.budgetCategory.update({ where: { id }, data });
  return NextResponse.json({ ok: true, category });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireVaterAdminApiSession();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const cat = await ownedCategory(auth.session.userId, id);
  if (!cat) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  await prisma.budgetCategory.update({
    where: { id },
    data: { archived: true },
  });
  return NextResponse.json({ ok: true });
}
