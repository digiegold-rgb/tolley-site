/**
 * POST /api/animate/sms/webhook
 *
 * Inbound for the Jelly Studio Animate number (TWILIO_ANIMATE_FROM).
 * Keyword stub only: START / YES / STOP / HELP get the standard Jelly Studio
 * replies. No other customer SMS. Do not send "your film is ready" from here.
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
    return twimlResponse();
  }

  if (keyword === "start" || keyword === "stop") {
    await persistAnimateKeyword(from, keyword);
  }

  return twimlResponse(reply);
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
