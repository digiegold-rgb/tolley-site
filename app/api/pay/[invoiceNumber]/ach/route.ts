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
  const body = await request.json().catch(() => ({}));
  const stripeBankToken: string | undefined = body.stripeBankToken;

  if (!stripeBankToken) {
    return NextResponse.json({ error: "stripeBankToken required" }, { status: 400 });
  }

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

  if (invoice.status === "VOID") {
    return NextResponse.json({ error: "Invoice is voided" }, { status: 400 });
  }

  // Server-side amount — never trust client.
  const amount = invoice.amountDue;
  const amountCents = Math.round(amount * 100);

  if (amountCents <= 0) {
    return NextResponse.json({ error: "Invalid invoice amount" }, { status: 400 });
  }

  const stripe = getStripe();

  try {
    let customerId = invoice.contact?.email
      ? (await stripe.customers.list({ email: invoice.contact.email, limit: 1 })).data[0]?.id
      : undefined;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: invoice.contact?.email || undefined,
        name: invoice.contact?.name || "Invoice Client",
        metadata: { invoiceNumber },
      });
      customerId = customer.id;
    }

    // Plaid processor token → Customer bank source → PaymentIntent with us_bank_account.
    // createSource accepts the Plaid/Stripe processor token (ba_... or stripe-processor_...).
    const source = await stripe.customers.createSource(customerId, {
      source: stripeBankToken,
    }) as unknown as { id: string };

    const paymentIntent = await stripe.paymentIntents.create(
      {
        amount: amountCents,
        currency: "usd",
        customer: customerId,
        payment_method_data: {
          type: "us_bank_account",
        },
        payment_method_types: ["us_bank_account"],
        // Legacy bank source attached above; confirm with source param.
        source: source.id,
        confirm: true,
        description: `Invoice ${invoiceNumber}`,
        metadata: {
          invoiceNumber,
          invoiceId: invoice.id,
          paymentMethod: "ach",
        },
        mandate_data: {
          customer_acceptance: {
            type: "online",
            online: {
              ip_address: request.headers.get("x-forwarded-for") || "0.0.0.0",
              user_agent: request.headers.get("user-agent") || "unknown",
            },
          },
        },
      } as unknown as Stripe.PaymentIntentCreateParams,
      { idempotencyKey: `ach-${invoice.id}-${stripeBankToken.slice(-12)}` },
    );

    // For ACH, status is typically "processing" — not yet settled.
    // Do NOT mark invoice PAID here. The Stripe webhook flips it when settled.
    // Record the pending payment and store the PI id.
    const existing = await prisma.invoicePayment.findFirst({
      where: { reference: paymentIntent.id },
      select: { id: true },
    });
    if (existing) {
      await prisma.invoicePayment.update({
        where: { id: existing.id },
        data: { notes: `ACH via Plaid — ${paymentIntent.status}` },
      });
    } else {
      await prisma.invoicePayment.create({
        data: {
          invoiceId: invoice.id,
          amount,
          method: "ach",
          reference: paymentIntent.id,
          notes: `ACH via Plaid — initiated (${paymentIntent.status})`,
        },
      });
    }

    await prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        stripePaymentIntentId: paymentIntent.id,
        // Status stays SENT/OVERDUE until webhook confirms settlement.
      },
    });

    return NextResponse.json({
      success: true,
      paymentIntentId: paymentIntent.id,
      status: paymentIntent.status,
      message: "ACH payment initiated. Settles in 1-3 business days.",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Payment failed";
    console.error(`[ACH] ${invoiceNumber} failed:`, message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
