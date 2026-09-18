import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getLineup } from "@/lib/stream/lineup";
import { validateWdAdmin } from "@/lib/wd-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ slug: string }> };

export async function GET(_request: NextRequest, ctx: Ctx) {
  const { authed } = await validateWdAdmin();
  if (!authed) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { slug } = await ctx.params;
  const lineup = await getLineup(slug);
  if (!lineup) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ lineup }, { headers: { "cache-control": "no-store" } });
}

// { name?, currentIndex?, active? } — activating one lineup deactivates the rest.
export async function PATCH(request: NextRequest, ctx: Ctx) {
  const { authed } = await validateWdAdmin();
  if (!authed) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { slug } = await ctx.params;
  const body = await request.json().catch(() => ({}));

  const lineup = await prisma.streamLineup.findUnique({ where: { slug }, select: { id: true, _count: { select: { items: true } } } });
  if (!lineup) return NextResponse.json({ error: "not found" }, { status: 404 });

  const data: { name?: string; currentIndex?: number; active?: boolean } = {};
  if (typeof body?.name === "string" && body.name.trim()) data.name = body.name.trim().slice(0, 120);
  if (Number.isInteger(body?.currentIndex)) {
    data.currentIndex = Math.min(Math.max(0, body.currentIndex), Math.max(0, lineup._count.items - 1));
  }
  if (typeof body?.active === "boolean") data.active = body.active;

  const updated = await prisma.$transaction(async (tx) => {
    if (data.active === true) {
      await tx.streamLineup.updateMany({ where: { active: true, id: { not: lineup.id } }, data: { active: false } });
    }
    return tx.streamLineup.update({ where: { id: lineup.id }, data });
  });
  return NextResponse.json({ lineup: updated });
}

export async function DELETE(_request: NextRequest, ctx: Ctx) {
  const { authed } = await validateWdAdmin();
  if (!authed) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { slug } = await ctx.params;
  // Items cascade. Products are never touched.
  await prisma.streamLineup.deleteMany({ where: { slug } });
  return NextResponse.json({ ok: true });
}
