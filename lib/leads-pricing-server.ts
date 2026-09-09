import "server-only";
import { unstable_cache } from "next/cache";
import { getStripeClient } from "@/lib/stripe";
import { getLeadsPriceIdsForInterval } from "@/lib/leads-subscription";

/** Annual dollar totals come from the same Stripe prices used by checkout. */
export const getAnnualLeadsPrices = unstable_cache(async () => {
  const result: Partial<Record<"starter" | "pro" | "team", number>> = {};
  if (!process.env.STRIPE_PRICE_STARTER_ANNUAL ||
      !process.env.STRIPE_PRICE_PRO_LEADS_ANNUAL || !process.env.STRIPE_PRICE_TEAM_ANNUAL) return result;
  try {
    const ids = getLeadsPriceIdsForInterval("annual");
    const stripe = getStripeClient();
    for (const tier of ["starter", "pro", "team"] as const) {
      const price = await stripe.prices.retrieve(ids[tier]);
      if (!price.active || price.currency !== "usd" || price.unit_amount === null ||
          price.recurring?.interval !== "year" || price.recurring.interval_count !== 1) return {};
      result[tier] = price.unit_amount / 100;
    }
    return result;
  } catch {
    console.error("[leads] Could not verify annual pricing; showing monthly plans only");
    return {};
  }
}, ["leads-annual-prices"], { revalidate: 300 });
