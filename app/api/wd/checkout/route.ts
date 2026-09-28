import { NextResponse } from "next/server";
import { rateLimitByIp } from "@/lib/rate-limit";
import { getStripeClient } from "@/lib/stripe";
import { WD_STRIPE_PRICE_BUNDLE, WD_STRIPE_PRICE_WASHER } from "@/lib/wd";
import { wdCheckoutZipDecision } from "@/lib/wd-service-zips";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CheckoutBody = {
  zip?: unknown;
  plan?: unknown;
  promo?: unknown;
  clientReferenceId?: unknown;
};

function requestOrigin(req: Request): string {
  const origin = req.headers.get("origin") || "";
  if (/^https:\/\/(www\.)?tolley\.io$/.test(origin)) return origin;
  if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return origin;
  return "https://www.tolley.io";
}

function clientReferenceId(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  return /^tolley_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
    ? value
    : undefined;
}

/**
 * POST /api/wd/checkout
 * Creates a subscription Checkout Session only for an allowlisted delivery ZIP.
 * Missing and out-of-area ZIPs return 4xx and never call Stripe.
 */
export async function POST(req: Request) {
  let body: CheckoutBody = {};
  try {
    body = (await req.json()) as CheckoutBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const decision = wdCheckoutZipDecision(body.zip);
  if (!decision.ok) {
    return NextResponse.json(
      { error: decision.error, ...(decision.outOfArea ? { outOfArea: true } : {}) },
      { status: decision.status },
    );
  }

  const plan = body.plan === "washer" || body.plan === "bundle" ? body.plan : null;
  if (!plan) {
    return NextResponse.json({ error: "Choose a washer or a washer and dryer bundle." }, { status: 400 });
  }

  const metadata: Record<string, string> = { product: "wd", zip: decision.zip, plan };
  const promo = typeof body.promo === "string" ? body.promo.trim() : "";
  if (promo && /^[A-Za-z0-9_-]{1,40}$/.test(promo)) metadata.promo = promo;
  const reference = clientReferenceId(body.clientReferenceId);
  const origin = requestOrigin(req);

  try {
    const limited = await rateLimitByIp(req, "wd:checkout", 10, 600);
    if (limited) return limited;
    const stripe = getStripeClient();
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{
        price: plan === "washer" ? WD_STRIPE_PRICE_WASHER : WD_STRIPE_PRICE_BUNDLE,
        quantity: 1,
      }],
      allow_promotion_codes: true,
      phone_number_collection: { enabled: true },
      shipping_address_collection: { allowed_countries: ["US"] },
      ...(reference ? { client_reference_id: reference } : {}),
      metadata,
      subscription_data: { metadata },
      success_url: `${origin}/wd?checkout=success`,
      cancel_url: `${origin}/wd`,
    });
    if (!session.url) {
      return NextResponse.json({ error: "Checkout could not be started. Please call us." }, { status: 502 });
    }
    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("[wd/checkout] session create failed", err instanceof Error ? err.message : "unknown");
    return NextResponse.json({ error: "Checkout could not be started. Please call us." }, { status: 502 });
  }
}
