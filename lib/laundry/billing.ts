import Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { getStripeClient } from "@/lib/stripe";
import { BASE } from "./config";
import { ownOperator } from "./store";
import { requireThat } from "./validation";
import type { Actor } from "./auth";
const PRODUCT = "laundry-marketplace";
const objectId = (v: string | { id: string } | null) =>
  typeof v === "string" ? v : v?.id;
export async function setupCard(who: Actor, operatorId: string) {
  requireThat(
    process.env.LAUNDRY_BILLING_ENABLED === "true",
    "Operator billing is not activated yet.",
    503,
  );
  const op = await ownOperator(who, operatorId),
    stripe = getStripeClient();
  requireThat(op.feeCents > 0, "The KC anchor does not need a billing card.");
  let customer = op.stripeCustomerId;
  if (!customer) {
    const c = await stripe.customers.create(
      {
        email: op.email,
        name: op.legalName,
        metadata: { product: PRODUCT, operatorId: op.id },
      },
      { idempotencyKey: `laundry-customer:${op.id}` },
    );
    customer = c.id;
    await prisma.laundryOperator.update({
      where: { id: op.id },
      data: { stripeCustomerId: customer },
    });
  }
  const session = await stripe.checkout.sessions.create({
    customer,
    mode: "setup",
    payment_method_types: ["card"],
    metadata: { product: PRODUCT, operatorId: op.id },
    setup_intent_data: { metadata: { product: PRODUCT, operatorId: op.id } },
    success_url: `${BASE}/laundry/dashboard?setup={CHECKOUT_SESSION_ID}`,
    cancel_url: `${BASE}/laundry/dashboard`,
    custom_text: {
      submit: {
        message:
          "Save this card for a one-time $45 charge when you confirm each marketplace delivery. Accepting a lead is free. See the operator agreement for cancellation and refund terms.",
      },
    },
  });
  return { url: session.url };
}
export async function saveSetup(session: Stripe.Checkout.Session) {
  if (
    session.metadata?.product !== PRODUCT ||
    session.mode !== "setup" ||
    session.status !== "complete"
  )
    return;
  requireThat(
    session.metadata.operatorId && objectId(session.customer),
    "Unrecognized card setup.",
  );
  const op = await prisma.laundryOperator.findFirst({
    where: {
      id: session.metadata.operatorId,
      stripeCustomerId: objectId(session.customer),
    },
  });
  requireThat(op && session.setup_intent, "Unrecognized card setup.");
  const setup = await getStripeClient().setupIntents.retrieve(
    objectId(session.setup_intent)!,
  );
  requireThat(
    setup.status === "succeeded" &&
      objectId(setup.customer) === op.stripeCustomerId &&
      setup.payment_method,
    "Card setup is incomplete.",
  );
  const at = new Date(session.created * 1000);
  await prisma.laundryOperator.updateMany({
    where: {
      id: op.id,
      OR: [{ paymentSetupAt: null }, { paymentSetupAt: { lte: at } }],
    },
    data: {
      paymentMethodId: objectId(setup.payment_method),
      paymentSetupAt: at,
    },
  });
}
export async function settleBooking(id: string) {
  requireThat(
    process.env.LAUNDRY_BILLING_ENABLED === "true",
    "Operator billing is not activated yet.",
    503,
  );
  const stripe = getStripeClient();
  // Persist an UNCONFIRMED intent before any charge. A crash here can only orphan an unpaid intent.
  let booking = await prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`billing:${id}`}))`;
      const b = await tx.laundryBooking.findUnique({
        where: { id },
        include: { lead: { include: { operator: true } } },
      });
      requireThat(b, "Booking not found.", 404);
      if (
        b.feeCents === 0 ||
        b.refundedAt ||
        b.status === "void" ||
        b.paymentIntentId ||
        b.status === "refund_pending"
      )
        return b;
      const op = b.lead.operator;
      requireThat(
        op?.stripeCustomerId && op.paymentMethodId,
        "Operator card required.",
      );
      const pi = await stripe.paymentIntents.create({
        amount: b.feeCents,
        currency: "usd",
        customer: op.stripeCustomerId,
        payment_method: op.paymentMethodId,
        payment_method_types: ["card"],
        metadata: { product: PRODUCT, bookingId: b.id, operatorId: op.id },
        description: "Laundry Rental Network confirmed delivery",
      });
      await tx.laundryBooking.update({
        where: { id },
        data: { paymentIntentId: pi.id },
      });
      return { ...b, paymentIntentId: pi.id };
    },
    { timeout: 20000 },
  );
  if (booking.feeCents === 0 || booking.refundedAt || booking.status === "void")
    return booking;
  if (!booking.paymentIntentId) {
    if (booking.status === "refund_pending")
      return prisma.laundryBooking.update({
        where: { id },
        data: { status: "void", disputeStatus: "refunded" },
      });
    return booking;
  }
  let pi = await stripe.paymentIntents.retrieve(booking.paymentIntentId, {
    expand: ["latest_charge"],
  });
  requireThat(
    pi.metadata.product === PRODUCT &&
      pi.metadata.bookingId === id &&
      pi.amount === booking.feeCents &&
      pi.currency === "usd",
    "Payment does not match this booking.",
  );
  const charge = typeof pi.latest_charge === "object" ? pi.latest_charge : null;
  if (charge && charge.amount_refunded > 0) {
    await prisma.laundryBooking.update({
      where: { id },
      data: {
        refundedCents: charge.amount_refunded,
        ...(charge.refunded
          ? {
              status: "refunded",
              refundedAt: booking.refundedAt || new Date(),
              paidAt: booking.paidAt || new Date(),
              disputeStatus: "refunded",
            }
          : {}),
      },
    });
    if (charge.refunded)
      return prisma.laundryBooking.findUniqueOrThrow({ where: { id } });
  }
  booking = await prisma.laundryBooking.findUniqueOrThrow({
    where: { id },
    include: { lead: { include: { operator: true } } },
  });
  if (booking.status === "refund_pending") {
    if (pi.status === "succeeded") {
      const refund = booking.refundId
        ? await stripe.refunds.retrieve(booking.refundId)
        : await stripe.refunds.create(
            {
              payment_intent: pi.id,
              reason: "requested_by_customer",
              metadata: { product: PRODUCT, bookingId: id },
            },
            { idempotencyKey: `laundry-refund:${id}` },
          );
      return prisma.laundryBooking.update({
        where: { id },
        data: {
          paidAt: booking.paidAt || new Date(),
          refundId: refund.id,
          ...(refund.status === "succeeded"
            ? { refundedCents: booking.feeCents }
            : {}),
          status:
            refund.status === "succeeded"
              ? "refunded"
              : refund.status === "failed" || refund.status === "canceled"
                ? "refund_failed"
                : "refund_pending",
          refundedAt: refund.status === "succeeded" ? new Date() : null,
          disputeStatus:
            refund.status === "succeeded" ? "refunded" : "approved",
        },
      });
    }
    if (
      [
        "requires_payment_method",
        "requires_confirmation",
        "requires_action",
      ].includes(pi.status)
    )
      pi = await stripe.paymentIntents.cancel(pi.id);
    if (pi.status === "canceled")
      return prisma.laundryBooking.update({
        where: { id },
        data: { status: "void", disputeStatus: "refunded" },
      });
    return booking;
  }
  if (
    ["requires_confirmation", "requires_payment_method"].includes(pi.status)
  ) {
    try {
      pi = await stripe.paymentIntents.confirm(
        pi.id,
        {
          payment_method: booking.lead.operator!.paymentMethodId!,
          off_session: true,
        },
        {
          idempotencyKey: `laundry-confirm:${id}:${booking.lead.operator!.paymentMethodId}`,
        },
      );
    } catch {
      pi = await stripe.paymentIntents.retrieve(pi.id);
    }
  }
  const status =
    pi.status === "succeeded"
      ? "paid"
      : pi.status === "canceled"
        ? "void"
        : pi.status === "processing"
          ? "processing"
          : "payment_failed";
  // A concurrent cancellation wins; the next worker pass refunds a charge that raced with it.
  await prisma.laundryBooking.updateMany({
    where: { id, status: { notIn: ["refund_pending", "refunded", "void"] } },
    data: {
      status,
      ...(status === "paid" && !booking.paidAt ? { paidAt: new Date() } : {}),
    },
  });
  return prisma.laundryBooking.findUniqueOrThrow({ where: { id } });
}
export async function laundryStripeEvent(event: Stripe.Event) {
  if (event.type === "charge.refunded") {
    const charge = event.data.object as Stripe.Charge;
    const paymentIntentId = objectId(charge.payment_intent);
    const b = paymentIntentId
      ? await prisma.laundryBooking.findUnique({ where: { paymentIntentId } })
      : null;
    if (b) {
      await settleBooking(b.id);
      return true;
    }
  }
  const obj = event.data.object as unknown as {
    metadata?: Record<string, string>;
  };
  if (obj.metadata?.product !== PRODUCT) return false;
  if (event.type === "checkout.session.completed")
    await saveSetup(
      await getStripeClient().checkout.sessions.retrieve(
        (event.data.object as Stripe.Checkout.Session).id,
      ),
    );
  else if (
    event.type.startsWith("payment_intent.") ||
    event.type.startsWith("refund.")
  ) {
    const id = obj.metadata.bookingId;
    if (id && (await prisma.laundryBooking.findUnique({ where: { id } })))
      await settleBooking(id);
  }
  return true;
}
