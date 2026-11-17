import { getStripeClient } from "@/lib/stripe";
import { laundryStripeEvent } from "@/lib/laundry/billing";
import { reply } from "@/lib/laundry/http";
export async function POST(req: Request) {
  const key = process.env.LAUNDRY_STRIPE_WEBHOOK_SECRET;
  if (!key) return reply({ error: "Webhook not configured" }, 503);
  let event;
  try {
    event = getStripeClient().webhooks.constructEvent(
      await req.text(),
      req.headers.get("stripe-signature") || "",
      key,
    );
  } catch {
    return reply({ error: "Invalid signature" }, 400);
  }
  try {
    await laundryStripeEvent(event);
    return reply({ received: true });
  } catch {
    return reply({ error: "Event processing failed; retry required" }, 500);
  }
}
