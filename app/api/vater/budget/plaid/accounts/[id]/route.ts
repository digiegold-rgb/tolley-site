import { NextResponse } from "next/server";
import { requireVaterAdminApiSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: RouteContext) {
  const auth = await requireVaterAdminApiSession();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const acct = await prisma.budgetPlaidAccount.findUnique({ where: { id } });
  if (!acct || acct.userId !== auth.session.userId) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const data: Record<string, unknown> = {};
  if (typeof body.name === "string") data.name = body.name.trim().slice(0, 80);
  if (typeof body.isPersonal === "boolean") data.isPersonal = body.isPersonal;
  if (typeof body.mask === "string" || body.mask === null) data.mask = body.mask;

  const updated = await prisma.budgetPlaidAccount.update({ where: { id }, data });
  return NextResponse.json({ ok: true, account: updated });
}
