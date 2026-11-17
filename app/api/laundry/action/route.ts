import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import { actor } from "@/lib/laundry/auth";
import { body, handle } from "@/lib/laundry/http";
import { leadAction, ownOperator } from "@/lib/laundry/store";
import { setupCard, settleBooking, saveSetup } from "@/lib/laundry/billing";
import { getStripeClient } from "@/lib/stripe";
import { requireThat } from "@/lib/laundry/validation";
import { runLaundryWorker } from "@/lib/laundry/worker";
export async function POST(req: Request) {
  return handle(async () => {
    const who = await actor(),
      b = await body(req);
    if (b.action === "setup") return setupCard(who, b.id);
    if (b.action === "sync_setup") {
      const s = await getStripeClient().checkout.sessions.retrieve(
        String(b.session),
      );
      await ownOperator(who, s.metadata?.operatorId || "invalid");
      await saveSetup(s);
      return { ok: true };
    }
    if (b.action === "approve" || b.action === "pause") {
      requireThat(who.admin, "Owner access required.", 403);
      const op = await prisma.laundryOperator.findUnique({
        where: { id: b.id },
      });
      requireThat(op, "Operator not found.", 404);
      requireThat(
        b.action !== "approve" || op.feeCents === 0 || op.paymentMethodId,
        "Operator must save a card before approval.",
        409,
      );
      await prisma.laundryOperator.update({
        where: { id: b.id },
        data: {
          status: b.action === "approve" ? "approved" : "paused",
          approvedAt: b.action === "approve" ? new Date() : null,
        },
      });
      return { ok: true };
    }
    if (b.action === "refund" || b.action === "reject_dispute") {
      requireThat(who.admin, "Owner access required.", 403);
      const booking = await prisma.laundryBooking.findUnique({
        where: { id: b.id },
      });
      requireThat(booking, "Booking not found.", 404);
      requireThat(
        booking.feeCents > 0 && !booking.refundedAt,
        "No refundable fee.",
        409,
      );
      await prisma.laundryBooking.update({
        where: { id: b.id },
        data:
          b.action === "refund"
            ? { status: "refund_pending", disputeStatus: "approved" }
            : { disputeStatus: "rejected" },
      });
      if (b.action === "refund") await settleBooking(b.id);
      return { ok: true };
    }
    if (b.action === "moderate_review") {
      requireThat(who.admin, "Owner access required.", 403);
      requireThat(
        typeof b.reason === "string" && b.reason.trim().length >= 10,
        "A moderation reason is required.",
      );
      await prisma.laundryReview.update({
        where: { id: b.id },
        data: {
          status: b.publish ? "published" : "hidden",
          moderationReason: b.reason.slice(0, 2000),
        },
      });
      return { ok: true };
    }
    if (b.action === "retry_payment") {
      const booking = await prisma.laundryBooking.findUnique({
        where: { id: b.id },
        include: { lead: true },
      });
      requireThat(booking?.lead.operatorId, "Booking not found.", 404);
      await ownOperator(who, booking.lead.operatorId);
      const result = await settleBooking(booking.id);
      if (result.paymentIntentId && result.status === "payment_failed") {
        const pi = await getStripeClient().paymentIntents.retrieve(
          result.paymentIntentId,
        );
        if (pi.status === "requires_action") {
          requireThat(
            process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
            "Bank verification is not configured. Contact support.",
            503,
          );
          return {
            requiresAction: true,
            clientSecret: pi.client_secret,
            publishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
          };
        }
      }
      return { status: result.status };
    }
    const result = await leadAction(who, b.id, b.action, b.value);
    after(async () => {
      await runLaundryWorker();
    });
    return result;
  });
}
