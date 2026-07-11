import type Stripe from "stripe";

import { prisma } from "@/lib/prisma";
import { getStripeClient } from "@/lib/stripe";
import { notifyTelegram } from "@/lib/budget/notify";

// Pool supply order (metadata.source="pools") — local KC delivery. Same
// narrow, self-contained pattern as the demo-site / video-offer handlers so
// it can't affect other product paths.

export function isPoolsEvent(
  checkoutSession: Stripe.Checkout.Session
): boolean {
  return checkoutSession.metadata?.source === "pools";
}

interface PoolOrderItem {
  productId: string;
  sku: string | null;
  name: string;
  quantity: number;
  unitPrice: number;
}

export async function fulfillPoolOrder(
  checkoutSession: Stripe.Checkout.Session
): Promise<void> {
  // Idempotent: webhook retries and duplicate events are no-ops.
  const existing = await prisma.poolOrder.findUnique({
    where: { stripeSessionId: checkoutSession.id },
    select: { id: true },
  });
  if (existing) return;

  const sessionAny = checkoutSession as unknown as {
    shipping_details?: {
      name?: string | null;
      address?: Record<string, unknown> | null;
    } | null;
    collected_information?: {
      shipping_details?: {
        name?: string | null;
        address?: Record<string, unknown> | null;
      } | null;
    } | null;
    customer_details?: {
      name?: string | null;
      email?: string | null;
      phone?: string | null;
    } | null;
  };
  const shipDetails =
    sessionAny.shipping_details ??
    sessionAny.collected_information?.shipping_details ??
    null;
  const customerName =
    shipDetails?.name ?? sessionAny.customer_details?.name ?? null;
  const customerEmail = sessionAny.customer_details?.email ?? null;
  const customerPhone = sessionAny.customer_details?.phone ?? null;
  const shippingAddress = shipDetails?.address ?? null;

  // Quantities come from checkout metadata; names/prices from the products.
  let requested: { productId: string; quantity: number }[] = [];
  try {
    requested = JSON.parse(checkoutSession.metadata?.items ?? "[]");
  } catch {
    requested = [];
  }
  if (requested.length === 0) {
    // Legacy sessions only carried productIds (quantity unknown → 1).
    try {
      const ids: string[] = JSON.parse(
        checkoutSession.metadata?.productIds ?? "[]"
      );
      requested = ids.map((productId) => ({ productId, quantity: 1 }));
    } catch {
      requested = [];
    }
  }

  let items: PoolOrderItem[];
  if (requested.length > 0) {
    const products = await prisma.poolProduct.findMany({
      where: { id: { in: requested.map((r) => r.productId) } },
    });
    const productMap = new Map(products.map((p) => [p.id, p]));
    items = requested.map((r) => {
      const p = productMap.get(r.productId);
      return {
        productId: r.productId,
        sku: p?.sku ?? null,
        name: p?.name ?? "Unknown product",
        quantity: r.quantity,
        unitPrice: p?.price ?? 0,
      };
    });
  } else {
    // Oversized cart: metadata was omitted (Stripe 500-char cap). Recover
    // names/quantities from Stripe line items; stock can't be decremented
    // without product IDs, but the order record + notify still land.
    const lineItems = await getStripeClient().checkout.sessions.listLineItems(
      checkoutSession.id,
      { limit: 100 }
    );
    items = lineItems.data.map((li) => ({
      productId: "",
      sku: null,
      name: li.description ?? "Unknown product",
      quantity: li.quantity ?? 1,
      unitPrice:
        typeof li.price?.unit_amount === "number"
          ? li.price.unit_amount / 100
          : 0,
    }));
  }

  const amountTotal =
    typeof checkoutSession.amount_total === "number"
      ? checkoutSession.amount_total / 100
      : items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);

  await prisma.poolOrder.create({
    data: {
      stripeSessionId: checkoutSession.id,
      amountTotal,
      customerEmail,
      customerName,
      customerPhone,
      shippingAddress: shippingAddress
        ? (shippingAddress as object)
        : undefined,
      items: items as unknown as object,
    },
  });

  // Decrement stock where tracked (stockQty nullable = untracked).
  for (const item of items) {
    await prisma.poolProduct
      .updateMany({
        where: { id: item.productId, stockQty: { not: null } },
        data: { stockQty: { decrement: item.quantity } },
      })
      .catch(() => {});
  }

  const addr = shippingAddress as Record<string, unknown> | null;
  const lines = [
    "🏊 POOL ORDER — tolley.io/pools",
    "",
    ...items.map((i) => `• ${i.quantity}× ${i.name} ($${i.unitPrice})`),
    "",
    `Total:   $${amountTotal.toFixed(2)}`,
    `Name:    ${customerName ?? "—"}`,
    `Phone:   ${customerPhone ?? "—"}`,
    `Email:   ${customerEmail ?? "—"}`,
    addr
      ? `Deliver: ${[addr.line1, addr.line2, addr.city, addr.state, addr.postal_code].filter(Boolean).join(", ")}`
      : "Deliver: NO ADDRESS COLLECTED",
    "",
    "Same-day promise if paid before noon — text a delivery window.",
  ];
  const tg = await notifyTelegram(lines.join("\n"));
  if (!tg.ok) {
    console.error("[pool-order] telegram notify failed:", tg.error);
  }
}
