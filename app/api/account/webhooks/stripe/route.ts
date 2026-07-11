export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { getStripeClient } from '@/lib/stripe';
import {
  recordInvoicePaymentFromIntent,
  recordInvoicePaymentFromSession,
} from '@/lib/account/record-invoice-payment';
import Stripe from 'stripe';

export async function POST(request: NextRequest) {
  const stripe = getStripeClient();
  const body = await request.text();
  const sig = request.headers.get('stripe-signature');

  if (!sig) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET_ACCOUNT;
  if (!webhookSecret) {
    console.error('STRIPE_WEBHOOK_SECRET_ACCOUNT not configured');
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invalid signature';
    console.error('Webhook signature verification failed:', message);
    return NextResponse.json({ error: `Webhook Error: ${message}` }, { status: 400 });
  }

  try {
    switch (event.type) {
      // A payment-link checkout fires both of these; the shared write-back is
      // idempotent on the PaymentIntent id, so recording from whichever arrives
      // first and skipping the rest is expected.
      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        const recorded = await recordInvoicePaymentFromIntent(paymentIntent);
        if (!recorded) {
          console.log(
            `payment_intent.succeeded ${paymentIntent.id} not recorded (no matching invoice, zero amount, or already recorded)`,
          );
        }
        break;
      }

      // checkout.session.completed resolves the invoice by the stored payment
      // link id even when the PaymentIntent carries no invoiceId metadata — the
      // path that reconciles links created before the metadata fix.
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const recorded = await recordInvoicePaymentFromSession(session);
        if (!recorded) {
          console.log(
            `checkout.session.completed ${session.id} not recorded (no matching invoice, unpaid, or already recorded)`,
          );
        }
        break;
      }

      default:
        console.log(`Unhandled webhook event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Webhook processing error';
    console.error('Webhook processing error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
