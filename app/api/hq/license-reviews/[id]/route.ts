/**
 * PATCH /api/hq/license-reviews/[id]
 * { action: "approve" } → licenseStatus=verified, digest keeps flowing
 * { action: "reject" }  → licenseStatus=invalid, subscriber status=canceled,
 *                         and their Stripe subscription is canceled immediately
 *                         (during the 3-day trial that means $0 ever charged).
 */

import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getStripeClient } from "@/lib/stripe";
import { validateWdAdmin } from "@/lib/wd-auth";

export const runtime = "nodejs";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { authed } = await validateWdAdmin();
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  let action: string;
  try {
    const body = await request.json();
    action = body.action;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (action !== "approve" && action !== "reject") {
    return NextResponse.json({ error: "action must be approve or reject" }, { status: 400 });
  }

  const subscriber = await prisma.digestSubscriber.findUnique({ where: { id } });
  if (!subscriber) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (subscriber.licenseStatus !== "manual_review") {
    return NextResponse.json(
      { error: `Already resolved (${subscriber.licenseStatus})` },
      { status: 409 }
    );
  }

  try {
    if (action === "approve") {
      const updated = await prisma.digestSubscriber.update({
        where: { id },
        data: { licenseStatus: "verified" },
        select: { id: true, licenseStatus: true, status: true },
      });
      return NextResponse.json({ review: updated });
    }

    // Reject: cancel the Stripe subscription first so a failure there leaves
    // the row in manual_review for a retry instead of silently keeping the
    // subscription alive.
    if (subscriber.stripeSubscriptionId) {
      const stripe = getStripeClient();
      try {
        await stripe.subscriptions.cancel(subscriber.stripeSubscriptionId);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        // Already-canceled subs shouldn't block the rejection.
        if (!/No such subscription|canceled/i.test(msg)) {
          console.error("[hq/license-reviews] stripe cancel failed", err);
          return NextResponse.json(
            { error: `Stripe cancel failed: ${msg}` },
            { status: 502 }
          );
        }
      }
    }
    const updated = await prisma.digestSubscriber.update({
      where: { id },
      data: { licenseStatus: "invalid", status: "canceled" },
      select: { id: true, licenseStatus: true, status: true },
    });
    return NextResponse.json({ review: updated });
  } catch (err) {
    console.error("[hq/license-reviews] update failed", err);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}
