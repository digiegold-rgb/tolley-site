import { NextResponse } from "next/server";
import Stripe from "stripe";
import { validateWdAdmin } from "@/lib/wd-auth";

export async function GET() {
  const { authed, role } = await validateWdAdmin();
  if (!authed || role !== "tolley") {
    return NextResponse.json({ error: "Tolley only" }, { status: 403 });
  }

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

    const subscriptions = await stripe.subscriptions.list({
      limit: 100,
      status: "all",
      expand: ["data.customer"],
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const getRaw = (obj: unknown): any => obj;

    const wdSubs = subscriptions.data
      .filter((sub) => {
        const amount = getRaw(sub.items.data[0]?.price)?.unit_amount as number | undefined;
        return amount === 4200 || amount === 5800;
      })
      .map((sub) => {
        const customer = sub.customer as Stripe.Customer;
        const amount: number = getRaw(sub.items.data[0]?.price)?.unit_amount || 0;
        const raw = getRaw(sub);
        return {
          id: sub.id,
          status: sub.status,
          amount: amount / 100,
          customerName: customer.name,
          customerEmail: customer.email,
          customerId: customer.id,
          currentPeriodEnd: raw.current_period_end ?? raw.currentPeriodEnd,
          canceledAt: raw.canceled_at ?? raw.canceledAt,
        };
      });

    return NextResponse.json({ subscriptions: wdSubs });
  } catch (err) {
    console.error("[wd/stripe GET]", err);
    return NextResponse.json({ error: "Stripe fetch failed" }, { status: 500 });
  }
}
