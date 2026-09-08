import assert from "node:assert/strict";
import type Stripe from "stripe";
import { prisma } from "../lib/prisma";
import { getStripeClient } from "../lib/stripe";
import { recordWdInvoice, syncWdSubscription } from "../lib/wd-subscription";
import { recordCheckoutAttribution } from "../lib/checkout-attribution";

if (!process.env.DATABASE_URL?.includes("127.0.0.1:55438/tolley_revenue_test")) throw new Error("Isolated test database required");
process.env.STRIPE_SECRET_KEY = "sk_test_revenue_repair_stub";
const stripe = getStripeClient();
const key = crypto.randomUUID();
const customerId = `cus_${key}`;
const subscription = { id: `sub_${key}`, customer: customerId, status: "past_due", cancel_at_period_end: false,
  items: { data: [{ current_period_end: 1790000000, quantity: 1, price: { unit_amount: 5800, recurring: { interval: "month", interval_count: 1 } } }] },
} as unknown as Stripe.Subscription;
let currentInvoice = { id: `in_${key}`, customer: customerId, status: "open", amount_paid: 0, amount_due: 5800,
  attempt_count: 2, created: 1754006400, parent: { subscription_details: { subscription: subscription.id } },
  status_transitions: { paid_at: null }, lines: { data: [{ period: { start: 1754006400 } }] },
} as unknown as Stripe.Invoice;
stripe.customers.retrieve = (async () => ({ id: customerId, email: `${key}@example.invalid` })) as typeof stripe.customers.retrieve;
stripe.subscriptions.retrieve = (async () => subscription) as typeof stripe.subscriptions.retrieve;
stripe.invoices.retrieve = (async () => currentInvoice) as typeof stripe.invoices.retrieve;
async function main() {
  const client = await prisma.wdClient.create({ data: { name: "Billing regression test", unitDescription: "Test",
    stripeCustomerId: customerId, stripeSubscriptionId: subscription.id, photoUrls: [], receiptUrls: [], blockedFields: [],
  } });
  await recordWdInvoice(currentInvoice, true);
  await recordWdInvoice(currentInvoice, true);
  assert.equal((await prisma.wdClient.findUniqueOrThrow({ where: { id: client.id } })).dunningStage, 2);
  assert.equal(await prisma.wdPayment.count({ where: { clientId: client.id } }), 1);
  currentInvoice = { ...currentInvoice, status: "paid", amount_paid: 5800, status_transitions: { ...currentInvoice.status_transitions, paid_at: 1754006400 } };
  subscription.status = "active";
  await recordWdInvoice(currentInvoice, false);
  await recordWdInvoice({ ...currentInvoice, status: "open" }, true);
  const payment = await prisma.wdPayment.findUniqueOrThrow({ where: { stripeInvoiceId: currentInvoice.id } });
  assert.equal(payment.status, "paid");
  assert.equal(payment.paidAt?.toISOString(), "2025-08-01T00:00:00.000Z");
  assert.equal((await prisma.wdClient.findUniqueOrThrow({ where: { id: client.id } })).dunningStage, 0);
  assert.equal(await syncWdSubscription({ ...subscription, id: `sub_old_${key}`, status: "canceled" }), false);
  assert.equal(await prisma.mustCompleteItem.count({ where: { id: `wd-link:sub_old_${key}`, status: "open" } }), 1);
  assert.equal((await prisma.wdClient.findUniqueOrThrow({ where: { id: client.id } })).stripeSubscriptionId, subscription.id);
  const session = { id: `cs_${key}`, client_reference_id: `tolley_${key}`, payment_status: "unpaid", amount_total: 5800, currency: "usd" } as Stripe.Checkout.Session;
  await recordCheckoutAttribution(session);
  assert.equal(await prisma.siteEvent.count({ where: { eventKey: `stripe_checkout:${session.id}` } }), 0);
  session.payment_status = "paid";
  await Promise.all([recordCheckoutAttribution(session), recordCheckoutAttribution(session)]);
  assert.equal(await prisma.siteEvent.count({ where: { eventKey: `stripe_checkout:${session.id}`, sessionId: key } }), 1);
  console.log("PASS: billing replay, duplicate failures, delayed failed webhook, historical paid date, subscription isolation, and verified payment attribution.");
}
main().catch(e => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
