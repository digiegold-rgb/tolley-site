import { syncInventoryAfterResponse } from "@/lib/shop/inventory-after";
import { randomUUID } from "node:crypto";
import { runInventory, InventoryError, inventoryTransaction, inventoryIssue } from "@/lib/shop/inventory";
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
  let reservationId: string | null = null;
  let reservedProductId: string | null = null;
  try {
    const { itemId } = await request.json();

    if (!itemId || typeof itemId !== "string") {
      return NextResponse.json({ error: "itemId required" }, { status: 400 });
    }

    const stripe = getStripeClient();
    const origin = process.env.APP_URL || "https://www.tolley.io";

    const product = await prisma.product
      .findFirst({
        where: { OR: [{ id: itemId }, { shopItemId: itemId }] },
        include: { listings: { where: { platform: "shop", status: "active" } } },
      });

    if (product && product.status === "listed" && product.listings.length > 0) {
      const hold = await runInventory({ productId: product.id, key: `checkout:${randomUUID()}`, action: "reserve", channel: "shop", quantity: 1, reference: `checkout:creating`, note: "Shop checkout" });
      reservationId = hold.movement.reservationId;
      reservedProductId = product.id;
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
          inventoryReservationId: reservationId!,
          ships: ships ? "1" : "0",
        },
        expires_at: Math.floor(Date.now() / 1000) + 1800,
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

      const session = await stripe.checkout.sessions.create(params, { idempotencyKey: `inventory-checkout:${reservationId}` });
      await prisma.inventoryReservation.update({ where: { id: reservationId! }, data: { reference: `checkout:${session.id}` } });
      syncInventoryAfterResponse(product.id);
      return NextResponse.json({ url: session.url });
    }

    return NextResponse.json({ error: "Item is sold, reserved, or unavailable. Please choose another item." }, { status: 409 });

  } catch (err) {
    if (err instanceof InventoryError) return NextResponse.json({ error: err.message }, { status: err.status });
    if (reservationId && reservedProductId) await inventoryTransaction(tx => inventoryIssue(tx, `checkout:${reservationId}`, reservedProductId, "shop", "Checkout creation did not finish cleanly. Stock remains held until the Stripe session is checked; do not release a possibly paid checkout.")).catch(() => undefined);
    console.error("[shop/checkout]", err);
    return NextResponse.json({ error: "Checkout failed" }, { status: 500 });
  }
}
