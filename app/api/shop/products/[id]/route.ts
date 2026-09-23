import { syncInventoryAfterResponse } from "@/lib/shop/inventory-after";
import { syncShopifyCatalog } from "@/lib/shop/shopify-catalog";
import { changeInventory, inventoryTransaction, inventoryIssue, InventoryError } from "@/lib/shop/inventory";
import { after, NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateShopAdmin } from "@/lib/shop-auth";
import { secretEquals } from "@/lib/secret-compare";
import { revalidatePath } from "next/cache";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const product = await prisma.product.findUnique({
    where: { id },
    include: { listings: true, priceHistory: { take: 20, orderBy: { capturedAt: "desc" } }, sales: true, sourceLot: true },
  });
  if (!product) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(product);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Admin cookie OR x-sync-secret — DGX pipelines (e.g. the TikTok draft-ID
  // write-back) need a machine path, same convention as /api/shop/products GET.
  const secret = req.headers.get("x-sync-secret");
  const machineAuthed = !!secret && secretEquals(secret, process.env.SYNC_SECRET);
  if (!machineAuthed && !(await validateShopAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();

  // Buyer-contact fields live on ShopSale, not Product — pull them off the
  // body before it hits product.update. See MarkSoldModal: all four are
  // optional, so we only log a ShopSale row when the seller actually
  // captured something (list-building infra, not a sales ledger for every
  // sale).
  const { buyerName, buyerPhone, buyerEmail, marketingOptIn, inventoryKey, ...productBody } = body;

  if (productBody.status === "sold") {
    if (typeof inventoryKey !== "string") return NextResponse.json({ error: "Record this sale through the Inventory desk or refresh the sale form." }, { status: 400 });
    try {
      const product = await inventoryTransaction(async tx => {
        const result = await changeInventory(tx, { productId: id, key: inventoryKey, action: "sale", channel: productBody.soldPlatform || "facebook", quantity: 1, salePrice: productBody.soldPrice });
        const p = await tx.product.findUniqueOrThrow({ where: { id }, include: { listings: true } });
        if (!result.replay) await tx.shopSale.create({ data: { productId: id, platform: productBody.soldPlatform || "facebook", externalId: inventoryKey, title: p.title, salePrice: productBody.soldPrice ?? p.targetPrice ?? 0, buyerName: buyerName || null, buyerPhone: buyerPhone || null, buyerEmail: buyerEmail || null, marketingOptIn: !!marketingOptIn } });
        return p;
      });
      syncInventoryAfterResponse(id);
      revalidatePath("/shop");
      return NextResponse.json(product);
    } catch (e) { return NextResponse.json({ error: e instanceof InventoryError ? e.message : "Could not record sale" }, { status: e instanceof InventoryError ? e.status : 500 }); }
  }
  if ("inventory" in productBody || "soldAt" in productBody || "soldPlatform" in productBody) return NextResponse.json({ error: "Use the Inventory desk to change stock or sales." }, { status: 400 });
  if (productBody.status && productBody.status !== "sold") {
    const stock = await prisma.inventoryStock.findUnique({ where: { productId: id } });
    if (stock && stock.onHand === 0 && productBody.status === "listed") return NextResponse.json({ error: "Count or return stock before relisting." }, { status: 409 });
  }

  // Recalculate totalCogs if cost fields change
  if (productBody.costBasis !== undefined || productBody.shippingCost !== undefined) {
    const existing = await prisma.product.findUnique({ where: { id } });
    if (existing) {
      const costBasis = productBody.costBasis ?? existing.costBasis ?? 0;
      const shippingCost = productBody.shippingCost ?? existing.shippingCost ?? 0;
      productBody.totalCogs = costBasis + shippingCost || null;
    }
  }

  const product = await prisma.product.update({
    where: { id },
    data: productBody,
    include: { listings: true },
  });

  if (["title", "description", "targetPrice", "weightOz", "brand"].some(key => key in productBody)) {
    const linked = await prisma.inventoryChannel.findUnique({ where: { productId_channel: { productId: id, channel: "shopify" } } });
    if (linked) after(async () => { try { await syncShopifyCatalog(id); } catch { await inventoryTransaction(tx => inventoryIssue(tx, `shopify-catalog:${id}`, id, "shopify", "Product details could not sync to Shopify. Use Update product details after checking the connection.")); } });
  }
  revalidatePath("/shop");
  return NextResponse.json(product);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const isAdmin = await validateShopAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  try {
    await inventoryTransaction(async tx => {
      if (await tx.inventoryReservation.count({ where: { productId: id, status: "active" } }) || await tx.inventoryChannel.count({ where: { productId: id } })) throw new InventoryError("Resolve reservations and connected listings before deleting this product. Archive it to retain the stock history.");
      await tx.product.delete({ where: { id } });
    });
  } catch (e) {
    if (e instanceof InventoryError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
  revalidatePath("/shop");
  return NextResponse.json({ ok: true });
}
