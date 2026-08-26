import twilio from "twilio";

import { isOptedOut, SmsOptedOutError } from "@/lib/sms-optout";
import {
  isSmsUndeliverablePhone,
  maybeFlagFromTwilioResult,
  SmsUndeliverableError,
  twilioErrorCodeOf,
} from "@/lib/wd/sms-undeliverable";

let client: ReturnType<typeof twilio> | null = null;

export function getTwilioClient() {
  if (client) return client;

  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;

  if (!sid || !token) {
    throw new Error("Missing TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN");
  }

  client = twilio(sid, token);
  return client;
}

export function getTwilioPhone(): string {
  const phone = process.env.TWILIO_PHONE_NUMBER;
  if (!phone) throw new Error("Missing TWILIO_PHONE_NUMBER");
  return phone;
}

/**
 * Send an SMS via Twilio.
 * Returns the message SID.
 *
 * Every send passes the opt-out ledger first (fail closed) — this is the last
 * line of defence behind the per-caller guards. Pass complianceReply for the
 * one legitimate exception: a reply that is itself required by the opt-out
 * flow (e.g. the opt-in confirmation after START).
 */
function twilioStatusCallbackUrl(): string {
  return (
    process.env.TWILIO_STATUS_CALLBACK_URL ||
    process.env.TWILIO_WEBHOOK_URL ||
    "https://www.tolley.io/api/sms/webhook"
  );
}

export async function sendSms(
  to: string,
  body: string,
  opts: { complianceReply?: boolean } = {}
): Promise<string> {
  if (!opts.complianceReply && (await isOptedOut(to))) {
    console.warn("[twilio] suppressed send to opted-out number", to);
    throw new SmsOptedOutError(to);
  }

  if (await isSmsUndeliverablePhone(to)) {
    console.warn("[twilio] suppressed send to undeliverable number", to);
    throw new SmsUndeliverableError(to);
  }

  const tw = getTwilioClient();
  const from = getTwilioPhone();

  // Truncate to ~1600 chars (standard SMS concatenation limit)
  const truncated = body.length > 1580 ? body.slice(0, 1577) + "..." : body;

  try {
    const msg = await tw.messages.create({
      to,
      from,
      body: truncated,
      statusCallback: twilioStatusCallbackUrl(),
    });
    await maybeFlagFromTwilioResult({
      phone: to,
      status: msg.status,
      errorCode: msg.errorCode,
    });
    return msg.sid;
  } catch (err) {
    await maybeFlagFromTwilioResult({
      phone: to,
      errorCode: twilioErrorCodeOf(err),
    });
    throw err;
  }
}

/**
 * Validate Twilio webhook signature.
 */
export function validateTwilioSignature(
  url: string,
  params: Record<string, string>,
  signature: string
): boolean {
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!token) return false;

  return twilio.validateRequest(token, signature, url, params);
}
