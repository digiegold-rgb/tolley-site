import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import Stripe from "stripe";

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ invoiceNumber: string }> },
) {
  const { invoiceNumber } = await params;
  const { stripeBankToken, amount } = await request.json();

  if (!stripeBankToken || !amount) {
    return NextResponse.json({ error: "stripeBankToken and amount required" }, { status: 400 });
  }

  // Find invoice
  const invoice = await prisma.invoice.findUnique({
    where: { invoiceNumber },
    include: { contact: true },
  });

  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  if (invoice.status === "PAID" || invoice.amountDue <= 0) {
    return NextResponse.json({ error: "Invoice already paid" }, { status: 400 });
  }

  try {
    // Create or find Stripe customer
    let customerId = invoice.contact?.email
      ? (await getStripe().customers.list({ email: invoice.contact.email, limit: 1 })).data[0]?.id
      : undefined;

    if (!customerId) {
      const customer = await getStripe().customers.create({
        email: invoice.contact?.email || undefined,
        name: invoice.contact?.name || "Invoice Client",
        metadata: { invoiceNumber },
      });
      customerId = customer.id;
    }

    // Create and attach PaymentMethod for us_bank_account (replaces deprecated createSource)
    const paymentMethod = await getStripe().paymentMethods.create({
      type: "us_bank_account",
      us_bank_account: {
        account_holder_type: "individual",
      },
      // stripeBankToken is a bank account token from Plaid/Stripe.js
      billing_details: {
        name: invoice.contact?.name || "Invoice Client",
        email: invoice.contact?.email || undefined,
      },
    } as Stripe.PaymentMethodCreateParams);

    await getStripe().paymentMethods.attach(paymentMethod.id, { customer: customerId });

    // Create PaymentIntent for ACH (replaces deprecated charges.create)
    const paymentIntent = await getStripe().paymentIntents.create({
      amount: Math.round(amount * 100), // cents
      currency: "usd",
      customer: customerId,
      payment_method: paymentMethod.id,
      payment_method_types: ["us_bank_account"],
      confirm: true,
      description: `Invoice ${invoiceNumber}`,
      metadata: {
        invoiceNumber,
        invoiceId: invoice.id,
        paymentMethod: "ach",
      },
    });

    // Record payment
    await prisma.invoicePayment.create({
      data: {
        invoiceId: invoice.id,
        amount,
        method: "ach",
        reference: paymentIntent.id,
        notes: `ACH via Plaid — ${paymentIntent.status}`,
      },
    });

    // Update invoice
    const newAmountPaid = invoice.amountPaid + amount;
    const newAmountDue = invoice.total - newAmountPaid;
    await prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        amountPaid: newAmountPaid,
        amountDue: Math.max(0, newAmountDue),
        status: newAmountDue <= 0 ? "PAID" : invoice.status,
        paidAt: newAmountDue <= 0 ? new Date() : undefined,
        stripePaymentIntentId: paymentIntent.id,
      },
    });

    return NextResponse.json({
      success: true,
      paymentIntentId: paymentIntent.id,
      status: paymentIntent.status, // "processing" for ACH
      message: "ACH payment initiated. Typically settles in 1-3 business days.",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Payment failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
