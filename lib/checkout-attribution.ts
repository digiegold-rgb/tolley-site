import type Stripe from "stripe";
import { prisma } from "@/lib/prisma";

/** Call only after Stripe signature verification. Public analytics cannot write this event. */
export async function recordCheckoutAttribution(session: Stripe.Checkout.Session) {
  const match = session.client_reference_id?.match(/^tolley_([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})$/i);
  if (session.payment_status !== "paid" || !match) return;
  const eventKey = `stripe_checkout:${session.id}`;
  await prisma.siteEvent.createMany({ skipDuplicates: true, data: {
    eventKey, site: "wd", path: "/wd", event: "payment_confirmed", sessionId: match[1],
    meta: { amountCents: session.amount_total, currency: session.currency, source: "stripe" },
  } });
}
