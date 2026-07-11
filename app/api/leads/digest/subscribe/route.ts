/**
 * POST /api/leads/digest/subscribe — self-serve start for the KC Motivated
 * Seller Digest ($199/mo founding rate).
 *
 * Body: { name, email, farmZips: string[] } (1–7 ZIPs, all inside the
 * coverage footprint in lib/leads/digest-coverage.ts).
 *
 * Flow: validate → upsert a pending DigestSubscriber row → create a Stripe
 * Checkout Session (subscription mode) carrying { product: "digest",
 * subscriberId } metadata on BOTH the session and the subscription → return
 * { url }. The webhook (lib/digest-subscription.ts) flips the row active when
 * payment lands; the Monday cron then picks it up automatically.
 *
 * Public by design — errors surface to the form (no silent catch).
 */

import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getStripeClient } from "@/lib/stripe";
import { notifyTelegram } from "@/lib/budget/notify";
import {
  DIGEST_PRODUCT_METADATA,
  getDigestFoundingPrice,
} from "@/lib/digest-subscription";
import { coverageSummary, isCoveredZip } from "@/lib/leads/digest-coverage";
import { rateLimitByIp } from "@/lib/rate-limit";
import { verifyLicense, type LicenseState } from "@/lib/leads/license-verify";

export const runtime = "nodejs";

const MAX_ZIPS = 7;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

interface SubscribeBody {
  name?: unknown;
  email?: unknown;
  farmZips?: unknown;
  licenseState?: unknown;
  licenseNumber?: unknown;
}

export async function POST(request: NextRequest) {
  const limited = await rateLimitByIp(request, "digest:subscribe", 10, 3600);
  if (limited) return limited;

  let body: SubscribeBody;
  try {
    body = (await request.json()) as SubscribeBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim().slice(0, 120) : "";
  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const email =
    typeof body.email === "string" ? body.email.trim().toLowerCase().slice(0, 254) : "";
  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "A valid email is required" }, { status: 400 });
  }

  if (!Array.isArray(body.farmZips)) {
    return NextResponse.json({ error: "farmZips must be an array" }, { status: 400 });
  }
  const farmZips = [
    ...new Set(
      body.farmZips
        .filter((z): z is string => typeof z === "string")
        .map((z) => z.trim())
    ),
  ];
  if (farmZips.length < 1 || farmZips.length > MAX_ZIPS) {
    return NextResponse.json(
      { error: `Pick between 1 and ${MAX_ZIPS} farm ZIP codes` },
      { status: 400 }
    );
  }
  const invalid = farmZips.filter((z) => !/^\d{5}$/.test(z) || !isCoveredZip(z));
  if (invalid.length > 0) {
    return NextResponse.json(
      {
        error: `We don't cover ${invalid.join(", ")} yet. Current coverage: ${coverageSummary()}. Reply to any tolley.io email if you want your area added.`,
      },
      { status: 400 }
    );
  }

  // License check — re-verified server-side so a direct POST can't skip the
  // form's verification step. MO is checked live against the state registry;
  // KS (and registry outages) fall through to manual review, which still
  // proceeds to checkout — the 3-day trial covers us until a human verifies.
  const licenseState =
    body.licenseState === "MO" || body.licenseState === "KS"
      ? (body.licenseState as LicenseState)
      : null;
  const licenseNumber =
    typeof body.licenseNumber === "string" ? body.licenseNumber.trim().slice(0, 30) : "";
  if (!licenseState || !licenseNumber) {
    return NextResponse.json(
      { error: "A Missouri or Kansas real estate license is required" },
      { status: 400 }
    );
  }
  const license = await verifyLicense(licenseState, licenseNumber);
  if (license.status === "invalid") {
    return NextResponse.json(
      { error: license.reason ?? "We couldn't find an active license for that number" },
      { status: 400 }
    );
  }
  if (license.status === "manual_review") {
    const tg = await notifyTelegram(
      `🪪 Digest signup needs license review: ${name} (${email}) — ${licenseState} #${licenseNumber}` +
        `\nApprove/reject in HQ → https://www.tolley.io/hq (Approvals tab)`
    );
    if (!tg.ok) console.warn("[digest/subscribe] license-review telegram failed:", tg.error);
  }

  // Upsert by email. New signups start pending (the webhook activates them);
  // a returning agent who is already active just gets told so — never a
  // second Stripe subscription.
  let subscriber: { id: string; status: string };
  try {
    const existing = await prisma.digestSubscriber.findUnique({
      where: { email },
      select: { id: true, status: true },
    });
    if (existing && (existing.status === "active" || existing.status === "trial")) {
      return NextResponse.json({ alreadySubscribed: true });
    }
    const licenseFields = {
      licenseState,
      licenseNumber,
      licenseStatus: license.status,
      licenseeName: license.licenseeName ?? null,
    };
    subscriber = existing
      ? await prisma.digestSubscriber.update({
          where: { id: existing.id },
          data: { name, farmZips, ...licenseFields },
          select: { id: true, status: true },
        })
      : await prisma.digestSubscriber.create({
          data: { name, email, farmZips, status: "pending", ...licenseFields },
          select: { id: true, status: true },
        });
  } catch (err) {
    console.error("[digest/subscribe] subscriber upsert failed", err);
    return NextResponse.json(
      { error: "Could not save your signup — please try again" },
      { status: 500 }
    );
  }

  const origin = new URL(request.url).origin;
  const meta = {
    product: DIGEST_PRODUCT_METADATA,
    subscriberId: subscriber.id,
  };

  try {
    const stripe = getStripeClient();
    const checkout = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: getDigestFoundingPrice(), quantity: 1 }],
      customer_email: email,
      metadata: meta,
      subscription_data: { metadata: meta, trial_period_days: 3 },
      billing_address_collection: "auto",
      allow_promotion_codes: false,
      success_url: `${origin}/leads/digest/welcome?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/leads/digest`,
    });
    if (!checkout.url) {
      throw new Error("Stripe returned a session without a URL");
    }
    return NextResponse.json({ url: checkout.url });
  } catch (err) {
    console.error("[digest/subscribe] stripe checkout creation failed", err);
    return NextResponse.json(
      { error: "Could not start checkout — please try again" },
      { status: 500 }
    );
  }
}
