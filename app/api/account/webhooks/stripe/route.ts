// @ts-nocheck — references removed Prisma models
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { getStripeClient } from '@/lib/stripe';
import { prisma } from '@/lib/prisma';
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
      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        const invoiceId = paymentIntent.metadata?.invoiceId;

        if (!invoiceId) {
          console.log('payment_intent.succeeded without invoiceId metadata, skipping');
          break;
        }

        const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
        if (!invoice) {
          console.error(`Invoice ${invoiceId} not found for payment_intent ${paymentIntent.id}`);
          break;
        }

        if (invoice.status === 'PAID') {
          console.log(`Invoice ${invoiceId} already paid, skipping`);
          break;
        }

        const amountReceived = paymentIntent.amount_received / 100;

        await prisma.invoicePayment.create({
          data: {
            invoiceId,
            amount: amountReceived,
            method: 'stripe',
            reference: paymentIntent.id,
            notes: `Stripe payment ${paymentIntent.id}`,
          },
        });

        const newAmountPaid = invoice.amountPaid + amountReceived;
        const newAmountDue = Math.max(0, invoice.total - newAmountPaid);
        const newStatus = newAmountDue <= 0.01 ? 'PAID' : invoice.status;

        await prisma.invoice.update({
          where: { id: invoiceId },
          data: {
            amountPaid: newAmountPaid,
            amountDue: newAmountDue,
            status: newStatus,
            stripePaymentIntentId: paymentIntent.id,
            paidAt: newStatus === 'PAID' ? new Date() : undefined,
          },
        });

        console.log(`Invoice ${invoiceId} payment recorded: $${amountReceived}, status: ${newStatus}`);
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
