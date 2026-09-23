import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { buildRows, toCsv } from "@/lib/stream/whatnot";
import { validateWdAdmin } from "@/lib/wd-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET → the lineup as a Whatnot bulk-import CSV (Seller Hub › show › Add › Create Temporary Listing › Upload CSV).
// ?preview=1 → JSON { rows: [{ title, warnings }] } so the builder can show what still needs attention.
// Sold items are left out; order = sale order. Photos ride along as public https Blob URLs (Whatnot fetches them).
export async function GET(request: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { authed } = await validateWdAdmin();
  if (!authed) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { slug } = await ctx.params;
  const lineup = await prisma.streamLineup.findUnique({
    where: { slug },
    include: {
      items: {
        orderBy: { sortOrder: "asc" },
        include: { product: { select: { id: true, title: true, description: true, imageUrls: true, sku: true, costBasis: true, inventory: true, status: true } } },
      },
    },
  });
  if (!lineup) return NextResponse.json({ error: "not found" }, { status: 404 });

  const holds = await prisma.inventoryReservation.findMany({ where: { reference: `show:${lineup.id}`, status: "active" } });
  const problems: string[] = [];
  const exportItems = lineup.items.filter(i => !i.soldAt).map(i => {
    const remaining = Math.max(0, i.quantity - i.soldQuantity);
    const stock = i.product.inventory;
    const available = (stock?.available ?? (i.product.status === "sold" ? 0 : 1)) + holds.filter(h => h.productId === i.product.id).reduce((n,h) => n+h.quantity,0);
    if (stock?.blocked || remaining > available) problems.push(`${i.product.title}: ${remaining} requested, ${stock?.blocked ? 0 : available} available to this show. Check inventory.`);
    return { ...i, quantity: Math.min(remaining, stock?.blocked ? 0 : available) };
  }).filter(i => i.quantity > 0);
  const rows = buildRows(
    exportItems.map((i) => ({
      title: i.product.title, description: i.product.description, imageUrls: i.product.imageUrls, sku: i.product.sku,
      productId: i.product.id, costBasis: i.product.costBasis, quantity: i.quantity, salePrice: i.salePrice,
      weightOz: i.weightOz, soldAt: i.soldAt, whatnot: i.whatnot,
    })),
    lineup.whatnot,
  );

  if (request.nextUrl.searchParams.get("preview")) {
    return NextResponse.json({ rows: [...rows.map((r) => ({ title: r.title, warnings: r.warnings })), ...problems.map(message => ({ title: "Inventory", warnings: [message] }))] }, { headers: { "cache-control": "no-store" } });
  }
  if (problems.length) return NextResponse.json({ error: problems.join("; ") }, { status: 409 });
  return new NextResponse(toCsv(rows), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="whatnot-${slug}-${new Date().toISOString().slice(0, 10)}.csv"`,
      "cache-control": "no-store",
    },
  });
}
