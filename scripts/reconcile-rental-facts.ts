/** Reads Stripe; only --apply updates existing, exactly-linked local records.
 * Never creates customers, drafts messages, retries charges, or marks invoices paid in Stripe. */
import { PrismaClient } from "@prisma/client";
import Stripe from "stripe";
import { writeFileSync } from "node:fs";
import { invoicePaymentFacts, monthlySubscriptionAmount } from "../lib/wd-payment-facts";
const p = new PrismaClient();
const apply = process.argv.includes("--apply");
const snapshotArg = process.argv.indexOf("--snapshot");
const snapshot = snapshotArg >= 0 ? process.argv[snapshotArg + 1] : null;
async function main() {
  if (apply && (!snapshot || !snapshot.startsWith("/"))) throw new Error("--apply requires an absolute --snapshot path");
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  const subscriptions = await stripe.subscriptions.list({ limit: 100, status: "all" }).autoPagingToArray({ limit: 10000 });
  const invoiceRows = await stripe.invoices.list({ limit: 100 }).autoPagingToArray({ limit: 10000 });
  const [clients, payments] = await Promise.all([
    p.wdClient.findMany({ select: { id: true, stripeSubscriptionId: true, subscriptionStatus: true, currentPeriodEnd: true, cancelAtPeriodEnd: true, updatedAt: true } }),
    p.wdPayment.findMany({ where: { stripeInvoiceId: { not: null } }, select: { id: true, stripeInvoiceId: true, status: true, amount: true, paidAt: true, source: true } }),
  ]);
  const uniqueSubs = new Set(clients.filter(c => c.stripeSubscriptionId && clients.filter(x => x.stripeSubscriptionId === c.stripeSubscriptionId).length === 1).map(c => c.stripeSubscriptionId));
  const changes = clients.flatMap(c => {
    const sub = subscriptions.find(s => s.id === c.stripeSubscriptionId);
    return sub && uniqueSubs.has(sub.id) ? [{ id: c.id, data: { subscriptionStatus: sub.status,
      monthlyAmount: monthlySubscriptionAmount(sub.items.data), currentPeriodEnd: sub.items.data[0]?.current_period_end ? new Date(sub.items.data[0].current_period_end * 1000) : null,
      cancelAtPeriodEnd: sub.cancel_at_period_end, stripeSyncedAt: new Date() } }] : [];
  });
  const paymentChanges = payments.flatMap(row => {
    const invoice = invoiceRows.find(i => i.id === row.stripeInvoiceId);
    return invoice && !(row.status === "paid" && invoice.status !== "paid") && (invoice.status === "paid" || invoice.status === "open" && invoice.attempt_count > 0)
      ? [{ id: row.id, data: invoicePaymentFacts(invoice) }] : [];
  });
  if (apply) {
    const [clientMetadata, paymentMetadata] = await Promise.all([
      p.wdClient.findMany({ where: { id: { in: changes.map(c => c.id) } }, select: { id: true, monthlyAmount: true, stripeSyncedAt: true } }),
      p.wdPayment.findMany({ where: { id: { in: paymentChanges.map(c => c.id) } }, select: { id: true, paidAtSource: true, failureAttempts: true } }),
    ]);
    writeFileSync(snapshot!, JSON.stringify({ capturedAt: new Date(),
      clients: changes.map(change => ({ before: { ...clients.find(c => c.id === change.id), ...clientMetadata.find(c => c.id === change.id) }, after: change.data })),
      payments: paymentChanges.map(change => ({ before: { ...payments.find(c => c.id === change.id), ...paymentMetadata.find(c => c.id === change.id) }, after: change.data })),
    }, null, 2), { mode: 0o600, flag: "wx" });
    await p.$transaction(async tx => {
      for (const c of changes) {
        const before = clients.find(row => row.id === c.id)!;
        const result = await tx.wdClient.updateMany({ where: { id: c.id, updatedAt: before.updatedAt, stripeSubscriptionId: before.stripeSubscriptionId }, data: c.data });
        if (result.count !== 1) throw new Error("Rental changed during review; transaction rolled back");
      }
      for (const c of paymentChanges) {
        const before = payments.find(row => row.id === c.id)!;
        const metadata = paymentMetadata.find(row => row.id === c.id)!;
        const result = await tx.wdPayment.updateMany({ where: { ...before, ...metadata }, data: c.data });
        if (result.count !== 1) throw new Error("Payment changed during review; transaction rolled back");
      }
    }, { timeout: 60000 });
  }
  console.log(JSON.stringify({ mode: apply ? "apply" : "review", linkedSubscriptions: changes.length, linkedPayments: paymentChanges.length,
    unlinkedOrAmbiguousClients: clients.length - changes.length, unverifiedInvoiceLinks: payments.length - paymentChanges.length }));
}
main().catch(e => { console.error(e instanceof Error && e.message.startsWith("--apply") ? e.message : "Reconciliation failed; check credentials, schema and snapshot path."); process.exitCode = 1; }).finally(() => p.$disconnect());
