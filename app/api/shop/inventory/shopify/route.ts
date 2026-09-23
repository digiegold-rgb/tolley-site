import { syncShopifyCatalog } from "@/lib/shop/shopify-catalog";
import { NextRequest, NextResponse } from "next/server";
import { validateWdAdmin } from "@/lib/wd-auth";
import { InventoryError } from "@/lib/shop/inventory";
import { linkShopifyProduct, syncShopifyProduct, reconcileShopifyProduct } from "@/lib/shop/shopify-inventory";
import { revalidatePath } from "next/cache";
export async function POST(req: NextRequest) {
  if (!(await validateWdAdmin()).authed) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await req.json();
    if (typeof body.productId !== "string") throw new InventoryError("Choose a product", 400);
    if (body.action === "catalog") return NextResponse.json(await syncShopifyCatalog(body.productId, body.locationId));
    if (body.action === "link") await linkShopifyProduct(body.productId, String(body.externalId), String(body.locationId));
    else if (body.action === "sync") await syncShopifyProduct(body.productId);
    else if (body.action === "reconcile") await reconcileShopifyProduct(body.productId);
    else throw new InventoryError("Choose link, sync, or reconcile", 400);
    revalidatePath("/shop");
    return NextResponse.json({ ok: true });
  } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : "Shopify connection failed" }, { status: e instanceof InventoryError ? e.status : 502 }); }
}
