import { NextResponse } from "next/server";
import Stripe from "stripe";

import { getStripeClient } from "@/lib/stripe";
import { isLeadsPriceId } from "@/lib/leads-subscription";
import {
  FOOD_PRODUCT_METADATA,
  isFoodPriceId,
} from "@/lib/food-subscription";
import {
  VATER_PRODUCT_METADATA,
  isVaterPriceId,
} from "@/lib/vater-subscription";
import {
  isWdSubscription,
  isWdInvoice,
  syncWdSubscription,
  recordWdInvoice,
} from "@/lib/wd-subscription";
// Engine 1 self-serve "buy this website" close ($500 + $49/mo). Narrow,
// self-contained handler so it can't affect the W/D / leads / food paths.
import {
  isDemoSiteEvent,
  isDemoSiteSubscription,
  fulfillDemoSiteSale,
} from "@/lib/demo-site-subscription";
// B2B "I made you a video" close ($250 + $99/mo). Same narrow pattern as the
// demo-site handler — self-contained, can't affect other product paths.
import {
  isVideoOfferEvent,
  isVideoOfferSubscription,
  fulfillVideoOfferSale,
} from "@/lib/video-offer-subscription";
// Vater pay-per-video: setup-mode card capture + accrual invoice lifecycle.
import {
  isVaterSetupSession,
  isVaterInvoice,
  handleVaterSetupCompleted,
  handleVaterInvoicePaid,
  handleVaterInvoiceFailed,
} from "@/lib/vater/billing/sync";
import {
  syncSubscriptionRecord,
  syncFromInvoice,
  syncLeadsSubscription,
  syncFoodSubscription,
  syncVaterSubscription,
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

        // Vater card-on-file capture (mode=setup — never a payment).
        if (isVaterSetupSession(checkoutSession)) {
          await handleVaterSetupCompleted(checkoutSession);
          break;
        }

        if (await fulfillVideoCredits(checkoutSession)) break;
        if (await fulfillShopSale(checkoutSession)) break;

        // Engine 1 "Make it live" site purchase (metadata.product=demo_site).
        if (isDemoSiteEvent(checkoutSession)) {
          await fulfillDemoSiteSale(checkoutSession);
          break;
        }

        // "Make it yours" video purchase (metadata.product=video_offer).
        if (isVideoOfferEvent(checkoutSession)) {
          await fulfillVideoOfferSale(checkoutSession);
          break;
        }

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

        // Food (Ruthann's Kitchen) subscription checkout
        if (checkoutSession.metadata?.product === FOOD_PRODUCT_METADATA) {
          const subId =
            typeof checkoutSession.subscription === "string"
              ? checkoutSession.subscription
              : checkoutSession.subscription?.id;
          if (subId) {
            const sub = await stripe.subscriptions.retrieve(subId);
            await syncFoodSubscription(sub, checkoutSession.metadata?.userId);
          }
          break;
        }

        // Vater Studio subscription checkout
        if (checkoutSession.metadata?.product === VATER_PRODUCT_METADATA) {
          const subId =
            typeof checkoutSession.subscription === "string"
              ? checkoutSession.subscription
              : checkoutSession.subscription?.id;
          if (subId) {
            const sub = await stripe.subscriptions.retrieve(subId);
            await syncVaterSubscription(sub, checkoutSession.metadata?.userId);
          }
          break;
        }

        // W/D rental via Stripe payment link — no metadata, detect by price.
        {
          const subId =
            typeof checkoutSession.subscription === "string"
              ? checkoutSession.subscription
              : checkoutSession.subscription?.id;
          if (subId) {
            const sub = await stripe.subscriptions.retrieve(subId);
            if (isWdSubscription(sub)) {
              await syncWdSubscription(sub);
              break;
            }
          }
        }

        await syncCheckoutSession(checkoutSession);
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const subPriceId = subscription.items?.data?.[0]?.price?.id;
        // Engine 1 site sale — fulfill once (idempotent vs the checkout event).
        if (isDemoSiteSubscription(subscription)) {
          await fulfillDemoSiteSale(subscription);
        } else if (isVideoOfferSubscription(subscription)) {
          await fulfillVideoOfferSale(subscription);
        } else if (isWdSubscription(subscription)) {
          await syncWdSubscription(subscription);
        } else if (subPriceId && isLeadsPriceId(subPriceId)) {
          await syncLeadsSubscription(subscription);
        } else if (subPriceId && isFoodPriceId(subPriceId)) {
          await syncFoodSubscription(subscription);
        } else if (subPriceId && isVaterPriceId(subPriceId)) {
          await syncVaterSubscription(subscription);
        } else if (subscription.metadata?.product === FOOD_PRODUCT_METADATA) {
          // Fallback: price ID not configured yet but metadata says food
          await syncFoodSubscription(subscription);
        } else if (subscription.metadata?.product === VATER_PRODUCT_METADATA) {
          // Fallback: price ID not configured yet but metadata says vater
          await syncVaterSubscription(subscription);
        } else {
          await syncSubscriptionRecord(subscription);
        }
        break;
      }
      case "invoice.paid": {
        const paidInvoice = event.data.object as Stripe.Invoice;
        if (isWdInvoice(paidInvoice)) {
          await recordWdInvoice(paidInvoice, false);
          break;
        }
        if (isVaterInvoice(paidInvoice)) {
          await handleVaterInvoicePaid(paidInvoice);
          break;
        }
        await fulfillVideoSubscriptionRenewal(paidInvoice);
        await syncFromInvoice(paidInvoice);
        break;
      }
      case "invoice.payment_failed": {
        const failedInvoice = event.data.object as Stripe.Invoice;
        if (isWdInvoice(failedInvoice)) {
          await recordWdInvoice(failedInvoice, true);
          break;
        }
        if (isVaterInvoice(failedInvoice)) {
          await handleVaterInvoiceFailed(failedInvoice);
          break;
        }
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
