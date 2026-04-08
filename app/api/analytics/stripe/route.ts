import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getStripeClient } from "@/lib/stripe";

export const maxDuration = 60; // pagination can take a bit

// WD price IDs
const WD_BUNDLE_PRICE = "price_1Rxey029zOZYc3GpfoFkUbmv"; // $58/mo
const WD_WASHER_PRICE = "price_1SB0UF29zOZYc3GpYYrlpCFe"; // $42/mo
const WD_PRICES = new Set([WD_BUNDLE_PRICE, WD_WASHER_PRICE]);

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const stripe = getStripeClient();

  // ─── Fetch balance ───
  const balance = await stripe.balance.retrieve();

  // ─── Paginate ALL subscriptions ───
  const allSubs: Awaited<ReturnType<typeof stripe.subscriptions.list>>["data"] = [];
  for await (const sub of stripe.subscriptions.list({ limit: 100, status: "all", expand: ["data.customer"] })) {
    allSubs.push(sub);
  }

  // ─── Paginate ALL payment intents (replaces deprecated charges.list) ───
  const allCharges: { amount: number; status: string; paid: boolean; created: number; fee: number }[] = [];
  for await (const pi of stripe.paymentIntents.list({ limit: 100, expand: ["data.charges.data.balance_transaction"] })) {
    // Each PaymentIntent may have one or more charges; take the first succeeded charge
    const charges = (pi as { charges?: { data?: unknown[] } }).charges?.data ?? [];
    if (charges.length > 0) {
      const charge = charges[0] as {
        amount: number;
        status: string;
        paid: boolean;
        created: number;
        balance_transaction: { fee: number } | string | null;
      };
      const bt = charge.balance_transaction;
      const fee = typeof bt === "object" && bt !== null ? (bt.fee || 0) : 0;
      allCharges.push({
        amount: charge.amount,
        status: charge.status,
        paid: charge.paid,
        created: charge.created,
        fee,
      });
    } else {
      // PaymentIntent with no charges yet (e.g. processing ACH)
      const succeeded = pi.status === "succeeded";
      allCharges.push({
        amount: pi.amount,
        status: succeeded ? "succeeded" : pi.status,
        paid: succeeded,
        created: pi.created,
        fee: 0,
      });
    }
  }

  // ─── Balance ───
  const available = balance.available.reduce((s, b) => s + b.amount, 0);
  const pending = balance.pending.reduce((s, b) => s + b.amount, 0);
  const instantAvailable = (balance.instant_available || []).reduce((s, b) => s + b.amount, 0);

  // ─── Filter WD subscriptions ───
  const wdSubs = allSubs.filter((s) =>
    s.items.data.some((i) => WD_PRICES.has(i.price.id)),
  );
  const otherSubs = allSubs.filter(
    (s) => !s.items.data.some((i) => WD_PRICES.has(i.price.id)),
  );

  // ─── Subscription status counts ───
  const wdByStatus: Record<string, number> = {};
  for (const s of wdSubs) {
    wdByStatus[s.status] = (wdByStatus[s.status] || 0) + 1;
  }

  // ─── Active WD breakdown ───
  const activeWd = wdSubs.filter((s) => ["active", "trialing", "past_due"].includes(s.status));
  let bundleCount = 0;
  let washerCount = 0;
  for (const s of activeWd) {
    for (const item of s.items.data) {
      if (item.price.id === WD_BUNDLE_PRICE) bundleCount++;
      else if (item.price.id === WD_WASHER_PRICE) washerCount++;
    }
  }

  // ─── MRR ───
  const wdMrr = bundleCount * 5800 + washerCount * 4200;
  const otherActiveSubs = otherSubs.filter((s) => ["active", "trialing"].includes(s.status));
  const otherMrr = otherActiveSubs.reduce((sum, s) => {
    return sum + s.items.data.reduce((is, item) => {
      const amt = item.price.unit_amount || 0;
      if (item.price.recurring?.interval === "year") return is + Math.round(amt / 12);
      if (item.price.recurring?.interval === "day") return is + amt * 30;
      return is + amt;
    }, 0);
  }, 0);

  // ─── Revenue from ALL charges (real fees from balance_transaction) ───
  const succeededCharges = allCharges.filter((c) => c.status === "succeeded" && c.paid);
  const totalRevenue = succeededCharges.reduce((s, c) => s + c.amount, 0);
  const totalFees = succeededCharges.reduce((s, c) => s + c.fee, 0);

  // Revenue by month
  const revenueByMonth: Record<string, { revenue: number; fees: number; count: number }> = {};
  for (const c of succeededCharges) {
    const d = new Date(c.created * 1000);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (!revenueByMonth[key]) revenueByMonth[key] = { revenue: 0, fees: 0, count: 0 };
    revenueByMonth[key].revenue += c.amount;
    revenueByMonth[key].fees += c.fee;
    revenueByMonth[key].count++;
  }

  // WD revenue (charges matching WD prices: $42 or $58)
  const wdAmounts = new Set([5800, 4200]);
  const wdCharges = succeededCharges.filter((c) => wdAmounts.has(c.amount));
  const wdRevenue = wdCharges.reduce((s, c) => s + c.amount, 0);
  const wdFees = wdCharges.reduce((s, c) => s + c.fee, 0);

  // ─── Customer list ───
  const customerMap: Record<string, {
    id: string;
    name: string;
    email: string;
    city: string;
    plan: string;
    amount: number;
    status: string;
    since: string;
  }> = {};

  for (const s of wdSubs) {
    const cust = s.customer as { id: string; name?: string; email?: string; address?: { city?: string } } | string;
    const custId = typeof cust === "string" ? cust : cust.id;
    const custName = typeof cust === "object" ? (cust.name || "") : "";
    const custEmail = typeof cust === "object" ? (cust.email || "") : "";
    const custCity = typeof cust === "object" ? (cust.address?.city || "") : "";

    const priceId = s.items.data[0]?.price.id;
    const plan = priceId === WD_BUNDLE_PRICE ? "Bundle ($58)" : priceId === WD_WASHER_PRICE ? "Washer ($42)" : "Other";
    const amount = s.items.data[0]?.price.unit_amount || 0;

    if (!customerMap[custId] || ["active", "past_due"].includes(s.status)) {
      customerMap[custId] = {
        id: custId,
        name: custName,
        email: custEmail,
        city: custCity,
        plan,
        amount,
        status: s.status,
        since: new Date(s.created * 1000).toISOString().split("T")[0],
      };
    }
  }

  const customers = Object.values(customerMap).sort((a, b) => {
    const statusOrder: Record<string, number> = { active: 0, past_due: 1, unpaid: 2, canceled: 3 };
    return (statusOrder[a.status] ?? 9) - (statusOrder[b.status] ?? 9);
  });

  // ─── Churn ───
  const canceledWd = wdSubs.filter((s) => s.status === "canceled");
  const pastDueWd = wdSubs.filter((s) => s.status === "past_due");
  const churnRate =
    wdSubs.length > 0
      ? Math.round((canceledWd.length / wdSubs.length) * 100)
      : 0;

  // ─── Past due alerts ───
  const pastDueAlerts = pastDueWd.map((s) => {
    const cust = s.customer as { name?: string; email?: string } | string;
    return {
      name: typeof cust === "object" ? (cust.name || "Unknown") : "Unknown",
      email: typeof cust === "object" ? (cust.email || "") : "",
      amount: s.items.data[0]?.price.unit_amount || 0,
      since: new Date(s.created * 1000).toISOString().split("T")[0],
    };
  });

  return NextResponse.json({
    balance: {
      available: available / 100,
      pending: pending / 100,
      instantAvailable: instantAvailable / 100,
    },
    wd: {
      mrr: wdMrr / 100,
      activeCount: activeWd.length,
      bundleCount,
      washerCount,
      byStatus: wdByStatus,
      totalRevenue: wdRevenue / 100,
      totalFees: wdFees / 100,
      netRevenue: (wdRevenue - wdFees) / 100,
      churnRate,
      pastDueCount: pastDueWd.length,
      canceledCount: canceledWd.length,
    },
    overall: {
      totalMrr: (wdMrr + otherMrr) / 100,
      totalRevenue: totalRevenue / 100,
      totalFees: totalFees / 100,
      netRevenue: (totalRevenue - totalFees) / 100,
      chargeCount: succeededCharges.length,
    },
    revenueByMonth: Object.entries(revenueByMonth)
      .map(([month, d]) => ({
        month,
        revenue: d.revenue / 100,
        fees: d.fees / 100,
        net: (d.revenue - d.fees) / 100,
        count: d.count,
      }))
      .sort((a, b) => a.month.localeCompare(b.month)),
    customers,
    pastDueAlerts,
    _meta: {
      totalChargesScanned: allCharges.length,
      totalSubsScanned: allSubs.length,
    },
  });
}
