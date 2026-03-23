import { NextResponse } from "next/server";
import Stripe from "stripe";

import { getStripeClient } from "@/lib/stripe";
import { isLeadsPriceId } from "@/lib/leads-subscription";
import {
  syncSubscriptionRecord,
  syncFromInvoice,
  syncLeadsSubscription,
  syncCheckoutSession,
  fulfillVideoCredits,
  fulfillVideoSubscriptionRenewal,
  fulfillShopSale,
} from "@/lib/stripe-webhook";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const stripe = getStripeClient();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    return NextResponse.json(
      { error: "Webhook secret not configured" },
      { status: 500 }
    );
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  const payload = await request.text();
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  } catch (error) {
    console.error("stripe webhook signature error", error);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const checkoutSession = event.data.object as Stripe.Checkout.Session;

        if (await fulfillVideoCredits(checkoutSession)) break;
        if (await fulfillShopSale(checkoutSession)) break;

        // Leads subscription checkout
        if (checkoutSession.metadata?.product === "leads") {
          const subId =
            typeof checkoutSession.subscription === "string"
              ? checkoutSession.subscription
              : checkoutSession.subscription?.id;
          if (subId) {
            const sub = await stripe.subscriptions.retrieve(subId);
            await syncLeadsSubscription(sub, checkoutSession.metadata?.userId);
          }
          break;
        }

        await syncCheckoutSession(checkoutSession);
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const subPriceId = subscription.items?.data?.[0]?.price?.id;
        if (subPriceId && isLeadsPriceId(subPriceId)) {
          await syncLeadsSubscription(subscription);
        } else {
          await syncSubscriptionRecord(subscription);
        }
        break;
      }
      case "invoice.paid": {
        const paidInvoice = event.data.object as Stripe.Invoice;
        await fulfillVideoSubscriptionRenewal(paidInvoice);
        await syncFromInvoice(paidInvoice);
        break;
      }
      case "invoice.payment_failed": {
        const failedInvoice = event.data.object as Stripe.Invoice;
        await syncFromInvoice(failedInvoice);
        break;
      }
      default:
        break;
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("stripe webhook processing error", error);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    );
  }
}
