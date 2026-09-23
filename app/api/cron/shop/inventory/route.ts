import { NextRequest, NextResponse } from "next/server";
import { secretEquals } from "@/lib/secret-compare";
import { prisma } from "@/lib/prisma";
import { shopifyConfigured, syncShopifyProduct } from "@/lib/shop/shopify-inventory";
import { sweepCheckouts } from "@/lib/shop/checkout-inventory";
import { getStripeClient } from "@/lib/stripe";
import { revalidatePath } from "next/cache";
export const runtime = "nodejs";
export const maxDuration = 120;
export async function GET(req: NextRequest) {
  if (!process.env.CRON_SECRET || !secretEquals(req.headers.get("authorization"), `Bearer ${process.env.CRON_SECRET}`)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const links = shopifyConfigured() ? await prisma.inventoryChannel.findMany({ where: { channel: "shopify" }, orderBy: { checkedAt: { sort: "asc", nulls: "first" } }, take: 15 }) : [];
  let failed = 0;
  for (let i = 0; i < links.length; i += 3) {
    const results = await Promise.allSettled(links.slice(i, i + 3).map(l => syncShopifyProduct(l.productId)));
    failed += results.filter(r => r.status === "rejected").length;
  }
  let checkouts = 0;
  if (process.env.STRIPE_SECRET_KEY) checkouts = await sweepCheckouts(getStripeClient());
  revalidatePath("/shop");
  return NextResponse.json({ checked: links.length, failed, checkouts });
}
