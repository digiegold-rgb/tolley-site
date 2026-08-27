/**
 * POST /api/animate/sms/webhook
 *
 * Inbound for the Jelly Studio Animate number (+19139149429 /
 * PN25da93f610855a1412223e622678bb48 on MG446284f555a5d1731f5deae2d8b46c40).
 * TWILIO_ANIMATE_FROM may override. Keywords START / YES / STOP / HELP get
 * the TwiML keyword reply. Any OTHER inbound (2026-08-26, Listing Studio
 * support line) is forwarded to Jared: a MustCompleteItem on /hq
 * (category "support") + a Telegram ping, with the sender matched to a studio
 * account by last-10 digits when VaterAccount.agentPhone exists. The only
 * reply is the TwiML "got it" — INBOUND ONLY. Never call sendSms() here (that
 * From is the W/D number) and never send anything unprompted (A2P scope +
 * no-autonomous-sends doctrine). Do not create or PATCH a Usa2p campaign.
 *
 * Never handles Wash & Dry 913-600-7508 (that stays on /api/sms/webhook).
 * Replies via TwiML so Twilio uses the number that received the inbound —
 * we never call sendSms() (that From is the W/D number).
 */
import { NextRequest, NextResponse } from "next/server";

import { validateTwilioSignature } from "@/lib/twilio";
import { classifySmsKeyword } from "@/lib/sms-optout";
import { isMissingRelationError } from "@/lib/vater/beta-schema";
import { prisma } from "@/lib/prisma";
import { last10Digits, toE164 } from "@/lib/phone";
import { notifyTelegram } from "@/lib/budget/notify";
import {
  animateSmsKeywordReply,
  isWashDrySmsNumber,
} from "@/lib/animate-sms";

export const runtime = "nodejs";
export const maxDuration = 15;

function twimlResponse(body?: string) {
  if (!body) {
    return new NextResponse("", { status: 200, headers: { "Content-Type": "text/xml" } });
  }
  const xml = `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escapeXml(body)}</Message></Response>`;
  return new NextResponse(xml, {
    status: 200,
    headers: { "Content-Type": "text/xml" },
  });
}

function escapeXml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const params: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    params[key] = String(value);
  }

  const from = params.From || "";
  const to = params.To || "";
  const body = (params.Body || "").trim();

  const signature = request.headers.get("x-twilio-signature") || "";
  const webhookUrl =
    process.env.TWILIO_ANIMATE_WEBHOOK_URL || "https://www.tolley.io/api/animate/sms/webhook";
  if (process.env.TWILIO_AUTH_TOKEN) {
    if (!signature || !validateTwilioSignature(webhookUrl, params, signature)) {
      console.warn("[animate-sms] Missing/invalid Twilio signature from", from);
      return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
    }
  }

  // Wrong number: this URL must never steal Wash & Dry inbound.
  if (isWashDrySmsNumber(to)) {
    console.warn("[animate-sms] inbound To is the Wash & Dry number — no reply");
    return twimlResponse();
  }

  if (!from || !body) return twimlResponse();

  const keyword = classifySmsKeyword(body);
  const reply = animateSmsKeywordReply(keyword);
  if (!reply || !keyword) {
    // Not a keyword: a human wrote to the support line. Forward it.
    await forwardSupportSms(from, body);
    return twimlResponse(SUPPORT_ACK);
  }

  if (keyword === "start" || keyword === "stop") {
    await persistAnimateKeyword(from, keyword);
  }

  return twimlResponse(reply);
}

/** TwiML reply to a free-text inbound. No promise of an automated follow-up. */
const SUPPORT_ACK = "Got it — Jared will call/text you back shortly. Reply STOP to opt out.";

/** Telegram parse_mode is Markdown — unbalanced _ * ` [ ] 400s the send. */
function tgSafe(v: string): string {
  return v.replace(/[_*`[\]]/g, "");
}

/**
 * Sender → studio account email, by last-10 digits against
 * VaterAccount.agentPhone (Listing Studio agent profile). The column ships
 * behind a migration applied by hand, so a missing column is "no match",
 * never an error. Falls back to User.animateSmsPhone (the START opt-in).
 */
async function matchSenderEmail(from: string): Promise<string | null> {
  const last10 = last10Digits(from);
  if (!last10) return null;
  const like = `%${last10}`;
  try {
    const rows = await prisma.$queryRaw<Array<{ email: string | null }>>`
      SELECT u."email"
      FROM "VaterAccount" va
      JOIN "User" u ON u."id" = va."userId"
      WHERE va."agentPhone" IS NOT NULL AND va."agentPhone" LIKE ${like}
      LIMIT 1
    `;
    if (rows[0]?.email) return rows[0].email;
  } catch (err) {
    if (!isMissingRelationError(err)) console.error("[animate-sms] agentPhone lookup failed", err);
  }
  try {
    const rows = await prisma.$queryRaw<Array<{ email: string | null }>>`
      SELECT "email" FROM "User"
      WHERE "animateSmsPhone" IS NOT NULL AND "animateSmsPhone" LIKE ${like}
      LIMIT 1
    `;
    return rows[0]?.email ?? null;
  } catch (err) {
    if (!isMissingRelationError(err)) console.error("[animate-sms] animateSmsPhone lookup failed", err);
    return null;
  }
}

/** Non-keyword inbound → /hq Must Complete (support) + Telegram. Best-effort. */
async function forwardSupportSms(from: string, body: string): Promise<void> {
  const last4 = (last10Digits(from) ?? from).slice(-4);
  const headline = body.replace(/\s+/g, " ").slice(0, 60);
  const email = await matchSenderEmail(from);
  const title = `[Listing Studio] SMS from ${last4} — ${headline}`;
  const detail = [
    body,
    "",
    "— context —",
    `from: ${from}`,
    `account: ${email ?? "(no studio account matched)"}`,
    `received: ${new Date().toISOString()}`,
    "Reply from your phone / Twilio console — nothing is sent automatically.",
  ].join("\n");
  try {
    const max = await prisma.mustCompleteItem.aggregate({ _max: { sortOrder: true } });
    await prisma.mustCompleteItem.create({
      data: {
        sortOrder: (max._max.sortOrder ?? 0) + 10,
        priority: "yellow",
        category: "support",
        title,
        detail,
        links: [{ label: "Text back", url: `sms:${from}` }, { label: "Call back", url: `tel:${from}` }],
        command: null,
        afterNote: null,
        source: "animate-sms-inbound",
      },
    });
  } catch (err) {
    console.error("[animate-sms] must-complete write failed", err);
  }
  try {
    await notifyTelegram(
      `📱 [Listing Studio] SMS from …${last4}${email ? ` (${tgSafe(email)})` : ""}: ${tgSafe(body).slice(0, 500)}\n\nhttps://www.tolley.io/hq`,
    );
  } catch (err) {
    console.error("[animate-sms] telegram notify failed", err);
  }
}

async function persistAnimateKeyword(from: string, keyword: "start" | "stop") {
  const e164 = toE164(from);
  const last10 = last10Digits(from);
  if (!e164 || !last10) return;
  const like = `%${last10}`;
  try {
    if (keyword === "start") {
      await prisma.$executeRaw`
        UPDATE "User"
        SET "animateSmsOptIn" = true,
            "animateSmsPhone" = ${e164},
            "animateSmsOptedInAt" = NOW()
        WHERE "animateSmsPhone" IS NOT NULL
          AND ("animateSmsPhone" = ${e164} OR "animateSmsPhone" LIKE ${like})
      `;
    } else {
      await prisma.$executeRaw`
        UPDATE "User"
        SET "animateSmsOptIn" = false
        WHERE "animateSmsPhone" IS NOT NULL
          AND ("animateSmsPhone" = ${e164} OR "animateSmsPhone" LIKE ${like})
      `;
    }
  } catch (err) {
    if (!isMissingRelationError(err)) {
      console.error("[animate-sms] persist keyword failed", err);
    }
  }
}
