import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateShopAdmin } from "@/lib/shop-auth";
import { sendSms } from "@/lib/twilio";
import { getGbp, renderSmsBody } from "@/lib/reviews/gbps";

export const maxDuration = 60;

function publicBaseUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL;
  if (explicit) return explicit.replace(/\/$/, "");
  return "https://www.tolley.io";
}

async function sendOne(id: string): Promise<{ ok: boolean; error?: string }> {
  const req = await prisma.reviewRequest.findUnique({ where: { id } });
  if (!req) return { ok: false, error: "not found" };
  if (req.status !== "queued") return { ok: false, error: `status=${req.status}` };

  const gbp = getGbp(req.gbpKey);
  if (!gbp || !gbp.reviewUrl) {
    await prisma.reviewRequest.update({
      where: { id },
      data: { status: "failed", errorMessage: "GBP not configured" },
    });
    return { ok: false, error: "GBP not configured" };
  }

  const link = `${publicBaseUrl()}/go/r/${req.shortCode}`;
  const body = renderSmsBody(gbp.smsTemplate, {
    name: req.recipientName,
    link,
  });

  if (req.channel === "sms") {
    if (!req.phone) {
      await prisma.reviewRequest.update({
        where: { id },
        data: { status: "failed", errorMessage: "No phone" },
      });
      return { ok: false, error: "no phone" };
    }

    // Honor SMS opt-out: skip if this phone has STOP'd via the existing
    // SmsConversation system. Marking as failed (not sent) so we don't
    // accidentally retry.
    const optedOut = await prisma.smsConversation.findFirst({
      where: { phoneNumber: req.phone, status: "opted_out" },
      select: { id: true },
    });
    if (optedOut) {
      await prisma.reviewRequest.update({
        where: { id },
        data: { status: "failed", errorMessage: "Recipient opted out (STOP)" },
      });
      return { ok: false, error: "opted out" };
    }

    try {
      const sid = await sendSms(req.phone, body);
      await prisma.reviewRequest.update({
        where: { id },
        data: {
          status: "sent",
          sentAt: new Date(),
          message: body,
          twilioSid: sid,
        },
      });
      return { ok: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "send failed";
      await prisma.reviewRequest.update({
        where: { id },
        data: { status: "failed", errorMessage: msg },
      });
      return { ok: false, error: msg };
    }
  }

  // Email channel — placeholder. Hook into existing transactional email
  // pipeline (Resend/SES) when ready. For now we mark as sent so the
  // dashboard reflects the operator's intent without actually emailing.
  await prisma.reviewRequest.update({
    where: { id },
    data: {
      status: "failed",
      errorMessage: "Email channel not yet wired — use SMS for now",
    },
  });
  return { ok: false, error: "email channel not implemented" };
}

/**
 * POST /api/reviews/send
 *
 * Body: { ids?: string[] } — send specific queued requests, or all queued
 * if omitted. Limited to 100 per call so a stuck queue doesn't burn the
 * Twilio budget all at once.
 */
export async function POST(req: NextRequest) {
  if (!(await validateShopAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const requestedIds: string[] = Array.isArray(body.ids) ? body.ids : [];

  const queued = await prisma.reviewRequest.findMany({
    where:
      requestedIds.length > 0
        ? { id: { in: requestedIds }, status: "queued" }
        : { status: "queued" },
    take: 100,
    select: { id: true },
  });

  const ids = queued.map((q) => q.id);
  // Process in the background so the operator's POST returns immediately.
  after(async () => {
    for (const id of ids) {
      try {
        await sendOne(id);
      } catch (err) {
        console.error("[reviews/send]", id, err);
      }
    }
  });

  return NextResponse.json({ scheduled: ids.length });
}
