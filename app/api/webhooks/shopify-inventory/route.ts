import { after, NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { syncShopifyProduct, verifyShopifyWebhook } from "@/lib/shop/shopify-inventory";
import { revalidatePath } from "next/cache";
export const runtime = "nodejs";
export async function POST(req: NextRequest) {
  const raw = await req.text();
  if (!verifyShopifyWebhook(raw, req.headers.get("x-shopify-hmac-sha256"), req.headers.get("x-shopify-shop-domain"))) return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  if (req.headers.get("x-shopify-topic") !== "inventory_levels/update") return NextResponse.json({ ignored: true });
  let body;
  try { body = JSON.parse(raw); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  if (!Number.isSafeInteger(body.inventory_item_id) || !Number.isSafeInteger(body.location_id)) return NextResponse.json({ error: "Invalid inventory identifiers" }, { status: 400 });
  const link = await prisma.inventoryChannel.findUnique({ where: { channel_externalId: { channel: "shopify", externalId: `gid://shopify/InventoryItem/${body.inventory_item_id}` } } });
  if (link?.locationId === `gid://shopify/Location/${body.location_id}`) {
    after(async () => { try { await syncShopifyProduct(link.productId); revalidatePath("/shop"); } catch (e) { console.error("Shopify inventory webhook deferred to reconciliation", e); } });
  }
  // The live-read reconciler makes duplicate and out-of-order notifications harmless; cron backs up missed delivery.
  return NextResponse.json({ received: true });
}
