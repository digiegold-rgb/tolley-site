/**
 * GET/POST /api/cron/deal-review-blast — daily MLS deal-close → review SMS.
 *
 * Schedule: daily 10:00 UTC (vercel.json crons entry).
 *
 * Finds Deal rows that closed 5-12 days ago, joins Client for phone, queues
 * ONE ReviewRequest per (deal, gbp_key=your_kc_homes), and immediately sends
 * the SMS. Idempotent — sourceType+sourceId composite key prevents duplicate
 * asks for the same closing.
 */

import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendSms } from "@/lib/twilio";
import { getGbp, renderSmsBody } from "@/lib/reviews/gbps";
import { newShortCode } from "@/lib/reviews/short-code";

export const maxDuration = 120;

const GBP_KEY = "your_kc_homes";
const DAYS_AFTER_CLOSE_MIN = 5;
const DAYS_AFTER_CLOSE_MAX = 12;

function authorized(req: NextRequest): boolean {
  const auth = req.headers.get("authorization");
  if (auth && auth === `Bearer ${process.env.CRON_SECRET}`) return true;
  const sync = req.headers.get("x-sync-secret");
  if (sync && sync === process.env.SYNC_SECRET) return true;
  return false;
}

function publicBaseUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL;
  if (explicit) return explicit.replace(/\/$/, "");
  return "https://www.tolley.io";
}

function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/[^\d+]/g, "");
  if (!digits) return null;
  if (/^\d{10}$/.test(digits)) return `+1${digits}`;
  if (/^1\d{10}$/.test(digits)) return `+${digits}`;
  if (/^\+\d{10,15}$/.test(digits)) return digits;
  return null;
}

async function isOptedOut(phone: string): Promise<boolean> {
  // The existing /api/sms/webhook route flips SmsConversation.status to
  // "opted_out" on STOP. Re-use that signal so review SMS respects it.
  const conv = await prisma.smsConversation.findFirst({
    where: { phoneNumber: phone, status: "opted_out" },
    select: { id: true },
  });
  return !!conv;
}

async function processDeal(deal: {
  id: string;
  buyerName: string | null;
  sellerName: string | null;
  Client: { firstName: string; lastName: string; phone: string | null } | null;
}): Promise<{ ok: boolean; reason?: string }> {
  // Already queued / sent for this deal?
  const existing = await prisma.reviewRequest.findFirst({
    where: { sourceType: "deal", sourceId: deal.id },
    select: { id: true },
  });
  if (existing) return { ok: false, reason: "already-requested" };

  const rawPhone = deal.Client?.phone;
  if (!rawPhone) return { ok: false, reason: "no-phone" };
  const phone = normalizePhone(rawPhone);
  if (!phone) return { ok: false, reason: "bad-phone" };

  if (await isOptedOut(phone)) return { ok: false, reason: "opted-out" };

  const gbp = getGbp(GBP_KEY);
  if (!gbp || !gbp.reviewUrl) {
    return { ok: false, reason: "gbp-not-configured" };
  }

  const recipientName = deal.Client
    ? `${deal.Client.firstName}`.trim()
    : deal.buyerName || deal.sellerName || null;

  const created = await prisma.reviewRequest.create({
    data: {
      phone,
      recipientName,
      sourceType: "deal",
      sourceId: deal.id,
      gbpKey: GBP_KEY,
      shortCode: newShortCode(),
      status: "queued",
      channel: "sms",
    },
  });

  const link = `${publicBaseUrl()}/go/r/${created.shortCode}`;
  const body = renderSmsBody(gbp.smsTemplate, { name: recipientName, link });

  try {
    const sid = await sendSms(phone, body);
    await prisma.reviewRequest.update({
      where: { id: created.id },
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
      where: { id: created.id },
      data: { status: "failed", errorMessage: msg },
    });
    return { ok: false, reason: `send-failed: ${msg}` };
  }
}

async function runBlast() {
  const cutoffMin = new Date(Date.now() - DAYS_AFTER_CLOSE_MIN * 24 * 3600 * 1000);
  const cutoffMax = new Date(Date.now() - DAYS_AFTER_CLOSE_MAX * 24 * 3600 * 1000);

  // closedDate OR closingDate — different deals were marked at different
  // times by different operators historically. Either signal is fine.
  const closedDeals = await prisma.deal.findMany({
    where: {
      OR: [
        { closedDate: { gte: cutoffMax, lte: cutoffMin } },
        { closingDate: { gte: cutoffMax, lte: cutoffMin } },
      ],
    },
    select: {
      id: true,
      buyerName: true,
      sellerName: true,
      Client: { select: { firstName: true, lastName: true, phone: true } },
    },
  });

  const results = { found: closedDeals.length, sent: 0, skipped: 0, failed: 0 };
  for (const d of closedDeals) {
    try {
      const r = await processDeal(d);
      if (r.ok) results.sent += 1;
      else if (r.reason === "send-failed") results.failed += 1;
      else results.skipped += 1;
    } catch (err) {
      console.error("[deal-review-blast]", d.id, err);
      results.failed += 1;
    }
  }
  return results;
}

async function handler(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  after(async () => {
    try {
      const summary = await runBlast();
      console.log("[deal-review-blast] done", summary);
    } catch (err) {
      console.error("[deal-review-blast] failed", err);
    }
  });

  return NextResponse.json({ scheduled: true });
}

export async function GET(req: NextRequest) {
  return handler(req);
}

export async function POST(req: NextRequest) {
  return handler(req);
}
