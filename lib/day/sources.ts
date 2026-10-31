import "server-only";
import Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { isWdPrice, isWdInvoice } from "@/lib/wd-product";
import { monthlySubscriptionAmount } from "@/lib/wd-payment-facts";
import { ledgerSchema } from "@/lib/live/core";
import { dailyBounds, dayKey, money, stub, type DaySection, type DaySnapshot } from "./core";

const washerPrice = "price_1SB0UF29zOZYc3GpYYrlpCFe"; // Existing /api/analytics/stripe price.
const wdPrice = (price: Stripe.Price) => isWdPrice(price) || price.id === washerPrice;

/** Refuse a truncated total. Bound pagination and each upstream request. */
async function collect<T>(iterable: AsyncIterable<T>): Promise<T[]> {
  const rows: T[] = [];
  for await (const row of iterable) {
    if (rows.length >= 5_000) throw new Error("Source exceeds snapshot limit");
    rows.push(row);
  }
  return rows;
}

export async function stripeSection(now: Date): Promise<DaySection> {
  if (!process.env.STRIPE_SECRET_KEY) return stub("Stripe", "Stripe read access is not configured.");
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { timeout: 8_000, maxNetworkRetries: 0 });
  const { start, end } = dailyBounds(now);
  const [subscriptions, receipts, invoices] = await Promise.all([
    collect(stripe.subscriptions.list({ status: "all", limit: 100 })),
    collect(stripe.balanceTransactions.list({ created: { gte: start.getTime() / 1000, lt: end.getTime() / 1000 }, limit: 100 })),
    collect(stripe.invoices.list({ status: "open", limit: 100 })),
  ]);
  const wd = subscriptions.filter(s => s.items.data.some(i => wdPrice(i.price)));
  const wdIds = new Set(wd.map(s => s.id));
  let mrrCents = 0;
  for (const sub of wd.filter(s => ["active", "past_due"].includes(s.status))) {
    if (sub.items.has_more) throw new Error("Incomplete subscription items");
    const items = sub.items.data.filter(i => wdPrice(i.price));
    if (items.some(i => i.price.currency !== "usd")) throw new Error("Unsupported currency");
    const dollars = monthlySubscriptionAmount(items);
    if (dollars == null) throw new Error("Unsupported recurring interval");
    mrrCents += Math.round(dollars * 100);
  }
  const late = invoices.filter(invoice => {
    const parent = invoice.parent?.subscription_details?.subscription;
    const subscription = typeof parent === "string" ? parent : parent?.id;
    const belongs = (subscription && wdIds.has(subscription)) || isWdInvoice(invoice);
    const overdue = invoice.due_date != null ? invoice.due_date < now.getTime() / 1000
      : invoice.collection_method === "charge_automatically" && invoice.attempted;
    return belongs && overdue && invoice.amount_remaining > 0;
  });
  const income = receipts.filter(r => ["charge", "payment"].includes(r.type));
  if ([...income, ...late].some(r => r.currency !== "usd")) throw new Error("Unsupported currency");
  return {
    status: "live", source: "Stripe · USD",
    note: "W/D MRR: active + past-due contracts, before discounts; trials excluded. Income: all Stripe gross receipts recorded today in Central time, before fees/refunds; bank availability may be pending. Past-dues: overdue open W/D invoices.",
    metrics: [
      { label: "W/D MRR", value: money(mrrCents) },
      { label: "Today’s income", value: money(income.reduce((sum, r) => sum + r.amount, 0)) },
      { label: "W/D past-dues", value: money(late.reduce((sum, r) => sum + r.amount_remaining, 0)) },
    ],
    items: [`${late.length} overdue invoice${late.length === 1 ? "" : "s"} · ${wd.filter(s => s.status === "past_due").length} past-due subscriptions`],
  };
}

async function cleanoutsSection(now: Date): Promise<DaySection> {
  const { start, end } = dailyBounds(now);
  // The saved inquiry source used by /api/cleanouts/quote; no customer records modified.
  const count = await prisma.growthLead.count({ where: { offer: "cleanout", source: "cleanouts-page", createdAt: { gte: start, lt: end } } });
  return { status: "live", source: "Tolley saved cleanout inquiries", note: "New quote requests saved today in Central time. This is the site’s inquiry database; tolley-pay does not expose a verified lead feed.", metrics: [{ label: "New today", value: String(count) }], items: [] };
}

async function mlsSection(): Promise<DaySection> {
  // Same eligibility as /api/leads/digest. Query directly; never call the sending cron.
  const where = { status: "new", score: { gte: 25 } };
  const [count, leads, newest] = await Promise.all([
    prisma.lead.count({ where }),
    prisma.lead.findMany({ where, orderBy: [{ score: "desc" }, { id: "asc" }], take: 3,
      select: { score: true, listing: { select: { address: true, city: true } } } }),
    prisma.listing.findFirst({ orderBy: { lastSynced: "desc" }, select: { lastSynced: true } }),
  ]);
  const lastSync = newest?.lastSynced;
  const stale = !lastSync || Date.now() - lastSync.getTime() > 86_400_000;
  return { status: "live", source: "/leads/digest · saved seller pipeline",
    note: `New-status leads scoring 25+, across the existing pipeline (not just today). ${stale ? "MLS source is stale or has never synced. " : ""}Latest listing sync: ${lastSync?.toISOString() ?? "unknown"}.`,
    metrics: [{ label: "Seller alerts", value: String(count) }],
    items: leads.map(l => `${l.score}/100 · ${l.listing ? `${l.listing.address}${l.listing.city ? `, ${l.listing.city}` : ""}` : "Unlinked property"}`),
  };
}

async function whatnotSection(): Promise<DaySection> {
  const show = await prisma.liveShow.findFirst({ where: { endedAt: { not: null } }, orderBy: { endedAt: "desc" }, select: { title: true, endedAt: true, ledger: true } });
  if (!show) return stub("Saved Whatnot show ledger", "No completed Whatnot show has been recorded.");
  const ledger = ledgerSchema.safeParse(show.ledger);
  if (!ledger.success) return stub("Saved Whatnot show ledger", "The latest completed show has no complete numbers recorded.");
  const l = ledger.data;
  return { status: "live", source: "Saved Whatnot show ledger",
    note: `${show.title} · ended ${show.endedAt!.toISOString()}. ${l.settled ? "Marked settled." : "Provisional, not settled."} Recorded ledger, not a live Whatnot API pull; sales are not added to Stripe income.`,
    metrics: [{ label: "Show sales", value: money(Math.round(l.sales * 100)) }, { label: "Orders", value: String(l.orders) }], items: [],
  };
}

async function safeSource(source: string, run: () => Promise<DaySection>): Promise<DaySection> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([run(), new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("Timeout")), 25_000); })]);
  } catch {
    // Never persist or expose upstream error text, credentials, or raw records.
    return stub(source, "Source unavailable or incomplete. Refresh to retry; no total has been assumed.");
  } finally { clearTimeout(timer); }
}

export async function pullSnapshot(now = new Date()): Promise<DaySnapshot> {
  const [stripe, cleanouts, mls, whatnot] = await Promise.all([
    safeSource("Stripe", () => stripeSection(now)),
    safeSource("Tolley saved cleanout inquiries", () => cleanoutsSection(now)),
    safeSource("/leads/digest", mlsSection), safeSource("Saved Whatnot show ledger", whatnotSection),
  ]);
  return { version: 1, generatedAt: now.toISOString(), day: dayKey(now), sections: {
    stripe, cleanouts, mls, whatnot,
    pay: stub("tolley-pay", "No verified read-only paid-page feed is available. Checkout creation is not proof of payment."),
    calendar: stub("Calendar", "No calendar connection is configured. This does not mean the day is free."),
  } };
}
