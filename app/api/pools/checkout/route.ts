import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getStripeClient } from "@/lib/stripe";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const { items } = await request.json();

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "Items required" }, { status: 400 });
    }

    // Look up all products
    const productIds = items.map((i: { productId: string }) => i.productId);
    const products = await prisma.poolProduct.findMany({
      where: { id: { in: productIds }, status: "active" },
    });

    if (products.length !== items.length) {
      return NextResponse.json(
        { error: "One or more items are unavailable" },
        { status: 400 }
      );
    }

    const productMap = new Map(products.map((p) => [p.id, p]));

    const stripe = getStripeClient();
    const origin = request.headers.get("origin") || "https://www.tolley.io";

    const line_items = items.map(
      (item: { productId: string; quantity: number }) => {
        const product = productMap.get(item.productId)!;
        return {
          price_data: {
            currency: "usd",
            product_data: {
              name: product.name,
              ...(product.description
                ? { description: product.description }
                : {}),
              ...(product.imageUrl ? { images: [product.imageUrl] } : {}),
            },
            unit_amount: Math.round(product.price * 100),
          },
          quantity: item.quantity,
        };
      }
    );

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items,
      metadata: {
        source: "pools",
        productIds: JSON.stringify(productIds),
      },
      success_url: `${origin}/pools?purchased=true`,
      cancel_url: `${origin}/pools`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("[pools/checkout]", err);
    return NextResponse.json({ error: "Checkout failed" }, { status: 500 });
  }
}
