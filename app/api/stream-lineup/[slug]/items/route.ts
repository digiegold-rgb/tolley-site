import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { ITEM_INCLUDE, PRODUCT_SELECT, itemDefaults } from "@/lib/stream/lineup";
import { validateWdAdmin } from "@/lib/wd-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ slug: string }> };

// Add a product to the end of the lineup. { productId }
export async function POST(request: NextRequest, ctx: Ctx) {
  const { authed } = await validateWdAdmin();
  if (!authed) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { slug } = await ctx.params;
  const body = await request.json().catch(() => ({}));
  const productId = String(body?.productId ?? "");
  if (!productId) return NextResponse.json({ error: "productId required" }, { status: 400 });

  const [lineup, product] = await Promise.all([
    prisma.streamLineup.findUnique({ where: { slug }, select: { id: true } }),
    prisma.product.findUnique({ where: { id: productId }, select: PRODUCT_SELECT }),
  ]);
  if (!lineup) return NextResponse.json({ error: "lineup not found" }, { status: 404 });
  if (!product) return NextResponse.json({ error: "product not found" }, { status: 404 });

  const dup = await prisma.streamLineupItem.findUnique({
    where: { lineupId_productId: { lineupId: lineup.id, productId } },
    include: ITEM_INCLUDE,
  });
  if (dup) return NextResponse.json({ item: dup, deduped: true });

  const last = await prisma.streamLineupItem.aggregate({ where: { lineupId: lineup.id }, _max: { sortOrder: true } });
  const item = await prisma.streamLineupItem.create({
    data: { lineupId: lineup.id, productId, sortOrder: (last._max.sortOrder ?? 0) + 10, ...(await itemDefaults(product)) },
    include: ITEM_INCLUDE,
  });
  return NextResponse.json({ item });
}

// Bulk reorder. { order: [itemId, …] } — ids not in this lineup are ignored; items left out keep their place after the rest.
export async function PUT(request: NextRequest, ctx: Ctx) {
  const { authed } = await validateWdAdmin();
  if (!authed) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { slug } = await ctx.params;
  const body = await request.json().catch(() => ({}));
  const order: string[] = Array.isArray(body?.order) ? body.order.filter((x: unknown): x is string => typeof x === "string") : [];

  const lineup = await prisma.streamLineup.findUnique({
    where: { slug },
    select: { id: true, items: { orderBy: { sortOrder: "asc" }, select: { id: true } } },
  });
  if (!lineup) return NextResponse.json({ error: "lineup not found" }, { status: 404 });

  const mine = new Set(lineup.items.map((i) => i.id));
  const wanted = [...new Set(order)].filter((id) => mine.has(id));
  const rest = lineup.items.map((i) => i.id).filter((id) => !wanted.includes(id));
  const final = [...wanted, ...rest];
  await prisma.$transaction(
    final.map((id, i) => prisma.streamLineupItem.update({ where: { id }, data: { sortOrder: (i + 1) * 10 } })),
  );
  return NextResponse.json({ ok: true, order: final });
}
