import { syncInventoryAfterResponse } from "@/lib/shop/inventory-after";
import type Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { changeInventory, inventoryTransaction } from "./inventory";
import { revalidatePath } from "next/cache";

export async function releaseCheckoutReservation(session: Stripe.Checkout.Session) {
  const id = session.metadata?.inventoryReservationId;
  if (!id || session.status !== "expired" || session.payment_status === "paid") return;
  const productId = await inventoryTransaction(async tx => {
    const hold = await tx.inventoryReservation.findUnique({ where: { id } });
    if (!hold || hold.status !== "active") return;
    await changeInventory(tx, { productId: hold.productId, key: `stripe-expired:${session.id}`, action: "release", channel: "shop", reservationId: hold.id });
    return hold.productId;
  });
  if (productId) syncInventoryAfterResponse(productId);
  revalidatePath("/shop");
}

export async function sweepCheckouts(stripe: Stripe) {
  const holds = await prisma.inventoryReservation.findMany({ where: { status: "active", channel: "shop", reference: { startsWith: "checkout:cs_" }, createdAt: { lt: new Date(Date.now() - 35 * 60000) } }, take: 30 });
  for (const hold of holds) {
    const session = await stripe.checkout.sessions.retrieve(hold.reference!.slice("checkout:".length));
    if (session.status === "expired") await releaseCheckoutReservation(session);
  }
  return holds.length;
}
