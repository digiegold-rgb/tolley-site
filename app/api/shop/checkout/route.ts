import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { getStripeClient } from "@/lib/stripe";

export const runtime = "nodejs";

function shippingOptions(
  shipPrice: number,
  title: string
): Stripe.Checkout.SessionCreateParams.ShippingOption[] {
  return [
    {
      shipping_rate_data: {
        type: "fixed_amount",
        fixed_amount: {
          amount: Math.round(shipPrice * 100),
          currency: "usd",
        },
        display_name: `Ship: ${title}`.slice(0, 100),
        delivery_estimate: {
          minimum: { unit: "business_day", value: 3 },
          maximum: { unit: "business_day", value: 7 },
        },
      },
    },
  ];
}

export async function POST(request: NextRequest) {
  try {
    const { itemId } = await request.json();

    if (!itemId || typeof itemId !== "string") {
      return NextResponse.json({ error: "itemId required" }, { status: 400 });
    }

    const stripe = getStripeClient();
    const origin = request.headers.get("origin") || "https://www.tolley.io";

    const product = await prisma.product
      .findUnique({
        where: { id: itemId },
        include: { listings: { where: { platform: "shop", status: "active" } } },
      })
      .catch(() => null);

    if (product && product.status === "listed" && product.listings.length > 0) {
      const listing = product.listings[0];
      const ships =
        typeof product.shipPrice === "number" && product.shipPrice >= 0;

      const params: Stripe.Checkout.SessionCreateParams = {
        mode: "payment",
        payment_method_types: ["card"],
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: {
                name: product.title,
                ...(product.description
                  ? { description: product.description.slice(0, 500) }
                  : {}),
                ...(product.imageUrls.length > 0
                  ? { images: [product.imageUrls[0]] }
                  : {}),
              },
              unit_amount: Math.round(listing.price * 100),
            },
            quantity: 1,
          },
        ],
        metadata: {
          shopItemId: product.shopItemId || product.id,
          productId: product.id,
          ships: ships ? "1" : "0",
        },
        success_url: `${origin}/shop?purchased=${product.id}`,
        cancel_url: `${origin}/shop`,
      };

      if (ships) {
        params.shipping_address_collection = {
          allowed_countries: ["US"],
        };
        params.shipping_options = shippingOptions(
          product.shipPrice ?? 0,
          product.title
        );
        params.phone_number_collection = { enabled: true };
      }

      const session = await stripe.checkout.sessions.create(params);
      return NextResponse.json({ url: session.url });
    }

    const item = await prisma.shopItem.findUnique({ where: { id: itemId } });

    if (!item || item.status !== "active") {
      return NextResponse.json({ error: "Item not available" }, { status: 404 });
    }

    const ships = typeof item.shipPrice === "number" && item.shipPrice >= 0;

    const params: Stripe.Checkout.SessionCreateParams = {
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: item.title,
              ...(item.description
                ? { description: item.description.slice(0, 500) }
                : {}),
              ...(item.imageUrls.length > 0
                ? { images: [item.imageUrls[0]] }
                : {}),
            },
            unit_amount: Math.round(item.price * 100),
          },
          quantity: 1,
        },
      ],
      metadata: {
        shopItemId: item.id,
        ships: ships ? "1" : "0",
      },
      success_url: `${origin}/shop?purchased=${item.id}`,
      cancel_url: `${origin}/shop`,
    };

    if (ships) {
      params.shipping_address_collection = { allowed_countries: ["US"] };
      params.shipping_options = shippingOptions(item.shipPrice ?? 0, item.title);
      params.phone_number_collection = { enabled: true };
    }

    const session = await stripe.checkout.sessions.create(params);
    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("[shop/checkout]", err);
    return NextResponse.json({ error: "Checkout failed" }, { status: 500 });
  }
}
