import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getStripeClient } from "@/lib/stripe";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const { itemId } = await request.json();

    if (!itemId || typeof itemId !== "string") {
      return NextResponse.json({ error: "itemId required" }, { status: 400 });
    }

    // Try Product model first (new)
    const product = await prisma.product.findUnique({
      where: { id: itemId },
      include: { listings: { where: { platform: "shop", status: "active" } } },
    }).catch(() => null);

    if (product && product.status === "listed" && product.listings.length > 0) {
      const listing = product.listings[0];
      const stripe = getStripeClient();
      const origin = request.headers.get("origin") || "https://www.tolley.io";

      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        payment_method_types: ["card"],
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: {
                name: product.title,
                ...(product.description ? { description: product.description } : {}),
                ...(product.imageUrls.length > 0 ? { images: [product.imageUrls[0]] } : {}),
              },
              unit_amount: Math.round(listing.price * 100),
            },
            quantity: 1,
          },
        ],
        metadata: {
          shopItemId: product.shopItemId || product.id,
          productId: product.id,
        },
        success_url: `${origin}/shop?purchased=${product.id}`,
        cancel_url: `${origin}/shop`,
      });

      return NextResponse.json({ url: session.url });
    }

    // Fallback to legacy ShopItem
    const item = await prisma.shopItem.findUnique({ where: { id: itemId } });

    if (!item || item.status !== "active") {
      return NextResponse.json({ error: "Item not available" }, { status: 404 });
    }

    const stripe = getStripeClient();
    const origin = request.headers.get("origin") || "https://www.tolley.io";

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: item.title,
              ...(item.description ? { description: item.description } : {}),
              ...(item.imageUrls.length > 0 ? { images: [item.imageUrls[0]] } : {}),
            },
            unit_amount: Math.round(item.price * 100),
          },
          quantity: 1,
        },
      ],
      metadata: {
        shopItemId: item.id,
      },
      success_url: `${origin}/shop?purchased=${item.id}`,
      cancel_url: `${origin}/shop`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("[shop/checkout]", err);
    return NextResponse.json({ error: "Checkout failed" }, { status: 500 });
  }
}
