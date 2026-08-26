/**
 * Jelly Studio A2P SMS — "text me when my film is done".
 *
 * Separate from Wash & Dry (913-600-7508 / campaign CQG8RGM). The Animate
 * sender is not purchased yet; NEXT_PUBLIC_ANIMATE_SMS_NUMBER is the public
 * START number and TWILIO_ANIMATE_FROM is the E.164 From. If either is empty
 * or accidentally set to a W/D / HELP number, we print "number posting shortly"
 * and never invent 7508.
 *
 * Customer "film is ready" sends wait until the campaign is VERIFIED. This
 * module only covers the live-site consent gate and keyword replies.
 */

export const ANIMATE_SMS_PRIVACY_URL = "https://www.tolley.io/animate/privacy";
export const ANIMATE_SMS_TERMS_URL = "https://www.tolley.io/animate/terms";
export const ANIMATE_SMS_NUMBER_PENDING = "number posting shortly";
export const ANIMATE_SMS_CONSENT_ID = "animate-sms-consent";

/** Wash & Dry rental SMS. Never the Animate START number. */
export const WD_SMS_DIGITS = "9136007508";
/** Voice / HELP line only. Never the Animate START number. */
export const ANIMATE_HELP_VOICE_DIGITS = "9132833826";

const FORBIDDEN_START_DIGITS = new Set([WD_SMS_DIGITS, ANIMATE_HELP_VOICE_DIGITS]);

/** Exact disclosure body (legal URLs rendered as links in the UI). */
export const ANIMATE_SMS_DISCLOSURE =
  "I agree to receive recurring account texts from Jelly Studio (Your KC Homes LLC) when my film is ready and about my studio account. Up to 8 msgs/month. Msg and data rates may apply. Reply STOP to cancel. Reply HELP for help. Consent is not required to request a seat or use the studio. Privacy https://www.tolley.io/animate/privacy Terms https://www.tolley.io/animate/terms.";

export const ANIMATE_SMS_OPT_IN_REPLY =
  "You're subscribed to Jelly Studio (Your KC Homes LLC) account texts. We'll text you when your film is ready and about your studio account. Up to 8 msgs/month. Msg and data rates may apply. Reply STOP to cancel. Reply HELP for help.";

export const ANIMATE_SMS_OPT_OUT_REPLY =
  "You are unsubscribed from Jelly Studio account texts. No more messages will be sent. Reply START to re-subscribe.";

export const ANIMATE_SMS_HELP_REPLY =
  "Jelly Studio (Your KC Homes LLC) account texts. Up to 8 msgs/month. Msg and data rates may apply. Reply STOP to cancel. Help: jared@yourkchomes.com or 913-283-3826.";

function last10(raw?: string | null): string | null {
  if (!raw) return null;
  const digits = String(raw).replace(/\D/g, "");
  if (digits.length < 10) return null;
  return digits.slice(-10);
}

function toE164(raw?: string | null): string | null {
  if (!raw) return null;
  const digits = String(raw).replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (String(raw).startsWith("+") && digits.length >= 8) return `+${digits}`;
  return null;
}

export function isForbiddenAnimateStartDigits(digits: string | null | undefined): boolean {
  if (!digits) return false;
  return FORBIDDEN_START_DIGITS.has(digits.replace(/\D/g, "").slice(-10));
}

export function isWashDrySmsNumber(raw?: string | null): boolean {
  return last10(raw) === WD_SMS_DIGITS;
}

/**
 * Public START number. Formats 10-digit US numbers as 913-XXX-XXXX.
 * Empty / forbidden values become "number posting shortly".
 */
export function animateSmsDisplayNumber(
  raw: string | null | undefined = process.env.NEXT_PUBLIC_ANIMATE_SMS_NUMBER,
): string {
  const value = (raw ?? "").trim();
  if (!value) return ANIMATE_SMS_NUMBER_PENDING;
  const digits = value.replace(/\D/g, "");
  const last10 = digits.slice(-10);
  if (last10.length !== 10 || isForbiddenAnimateStartDigits(last10)) {
    return ANIMATE_SMS_NUMBER_PENDING;
  }
  return `${last10.slice(0, 3)}-${last10.slice(3, 6)}-${last10.slice(6)}`;
}

export function animateSmsStartLine(
  raw: string | null | undefined = process.env.NEXT_PUBLIC_ANIMATE_SMS_NUMBER,
): string {
  return `You can also opt in by texting START or YES to ${animateSmsDisplayNumber(raw)}.`;
}

/** Server-only Animate From (E.164). Null when unset or a forbidden W/D number. */
export function animateSmsFromE164(
  raw: string | null | undefined = process.env.TWILIO_ANIMATE_FROM,
): string | null {
  const e164 = toE164((raw ?? "").trim());
  if (!e164 || isForbiddenAnimateStartDigits(e164)) return null;
  return e164;
}

export function animateSmsKeywordReply(keyword: "start" | "stop" | "help" | null): string | null {
  if (keyword === "start") return ANIMATE_SMS_OPT_IN_REPLY;
  if (keyword === "stop") return ANIMATE_SMS_OPT_OUT_REPLY;
  if (keyword === "help") return ANIMATE_SMS_HELP_REPLY;
  return null;
}

export type AnimateSmsLeadFields = {
  smsOptIn: boolean;
  phone: string | null;
};

/** Parse smsOptIn + phone from a seat/invite request body. */
export function parseAnimateSmsLeadFields(body: Record<string, unknown>): AnimateSmsLeadFields {
  const smsOptIn = body.smsOptIn === true || body.smsOptIn === "true" || body.smsOptIn === "on";
  const raw = typeof body.phone === "string" ? body.phone.trim().slice(0, 40) : "";
  const phone = raw ? toE164(raw) ?? raw : null;
  return { smsOptIn, phone };
}

export function animateSmsPhoneRequiredError(fields: AnimateSmsLeadFields): string | null {
  if (!fields.smsOptIn) return null;
  if (!fields.phone || !toE164(fields.phone)) {
    return "A valid US mobile number is required to opt in to texts.";
  }
  return null;
}
