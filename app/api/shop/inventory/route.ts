import { syncShopifyProduct, shopifyConfigured } from "@/lib/shop/shopify-inventory";
import { after, NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateShopAdmin } from "@/lib/shop-auth";
import { changeInventory, inventoryTransaction, InventoryError, type InventoryCommand } from "@/lib/shop/inventory";
import { revalidatePath } from "next/cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(req: NextRequest) {
  if (!(await validateShopAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const q = req.nextUrl.searchParams.get("q")?.slice(0, 120) ?? "";
  const products = await prisma.product.findMany({
    where: { status: { not: "archived" }, ...(q ? { OR: [{ title: { contains: q, mode: "insensitive" } }, { sku: { contains: q, mode: "insensitive" } }] } : {}) },
    select: { id: true, title: true, sku: true, status: true, imageUrls: true, targetPrice: true, fbListingId: true, inventory: true },
    orderBy: { updatedAt: "desc" }, take: 100,
  });
  const [reservations, movements, issues, lineups, channels] = await Promise.all([
    prisma.inventoryReservation.findMany({ where: { status: "active", productId: { in: products.map(p => p.id) } }, orderBy: { createdAt: "desc" } }),
    prisma.inventoryMovement.findMany({ where: queryFilter(q, products.map(p => p.id)), orderBy: { createdAt: "desc" }, take: 15 }),
    prisma.inventoryIssue.findMany({ where: { resolvedAt: null }, orderBy: { updatedAt: "desc" }, take: 100 }),
    prisma.streamLineup.findMany({ select: { id: true, slug: true, name: true }, orderBy: { updatedAt: "desc" }, take: 30 }),
    prisma.inventoryChannel.findMany({ where: { productId: { in: products.map(p => p.id) } } }),
  ]);
  const names = await prisma.product.findMany({ where: { id: { in: [...new Set([...movements.map(m => m.productId), ...issues.flatMap(i => i.productId ? [i.productId] : [])])] } }, select: { id: true, title: true } });
  const nameMap = new Map(names.map(p => [p.id, p.title]));
  const reversals = await prisma.inventoryMovement.findMany({ where: { action: "restore", reference: { in: movements.map(m => m.key) } }, select: { reference: true } });
  const reversed = new Set(reversals.map(r => r.reference));
  return NextResponse.json({ products, reservations, movements: movements.map(m => ({ ...m, title: nameMap.get(m.productId) ?? "Removed product", reversed: reversed.has(m.key) })), issues: issues.map(i => ({ ...i, title: nameMap.get(i.productId ?? "") ?? i.channel })), lineups, channels, shopifyConfigured: !!(process.env.SHOPIFY_SHOP_DOMAIN && process.env.SHOPIFY_ADMIN_ACCESS_TOKEN) }, { headers: { "cache-control": "no-store" } });
}
export async function POST(req: NextRequest) {
  if (!(await validateShopAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await req.json();
    if (body.action === "resolve") {
      if (typeof body.id !== "string") throw new InventoryError("Choose an issue", 400);
      await prisma.inventoryIssue.update({ where: { id: body.id }, data: { resolvedAt: new Date() } });
      return NextResponse.json({ ok: true });
    }
    if (typeof body.productId !== "string" || !["sale", "reserve", "release", "restore", "count"].includes(body.action)) throw new InventoryError("Invalid inventory action", 400);
    if (body.salePrice != null && (typeof body.salePrice !== "number" || !Number.isFinite(body.salePrice) || body.salePrice < 0)) throw new InventoryError("Enter a valid sale price", 400);
    const command: InventoryCommand = {
      productId: body.productId, key: body.key, action: body.action, channel: body.channel,
      quantity: body.quantity, reservationId: body.reservationId, reference: body.reference,
      note: typeof body.note === "string" ? body.note.slice(0, 500) : undefined,
      expectedRevision: body.expectedRevision, salePrice: body.salePrice,
    };
    const result = await inventoryTransaction(async tx => {
      // Checkout reservations may only be released by verified Stripe events.
      if (command.reservationId) {
        const hold = await tx.inventoryReservation.findUnique({ where: { id: command.reservationId } });
        if (hold?.reference?.startsWith("checkout:")) throw new InventoryError("This checkout reservation is managed by Stripe. It releases when checkout expires.");
      }
      const result = await changeInventory(tx, command);
      if (command.action === "sale" && !result.replay) {
        const product = await tx.product.findUniqueOrThrow({ where: { id: command.productId } });
        await tx.shopSale.create({ data: { productId: product.id, title: product.title, platform: command.channel, externalId: command.key, salePrice: command.salePrice ?? 0, fulfillment: "pickup" } });
      }
      return result;
    });
    if (shopifyConfigured()) after(async () => { try { await syncShopifyProduct(command.productId); } catch (e) { console.error("Deferred inventory sync", e); } });
    revalidatePath("/shop");
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof InventoryError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error("inventory action failed", e);
    return NextResponse.json({ error: "Could not save inventory. Refresh before retrying." }, { status: 500 });
  }
}

function queryFilter(q: string, productIds: string[]) { return q ? { productId: { in: productIds } } : {}; }
