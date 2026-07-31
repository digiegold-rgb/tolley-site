/**
 * lib/sms-optout.ts
 *
 * Single source of truth for SMS opt-out (TCPA / CTIA compliance).
 *
 * Every outbound SMS path must call isOptedOut() before sending. The check is
 * FAIL CLOSED: if the opt-out table can't be read we report "opted out" so a
 * database blip can never turn into an unlawful send.
 *
 * The ledger is SmsOptOut, keyed on the E.164 phone. We also honour the legacy
 * signal — SmsConversation.status === "opted_out" — so numbers that opted out
 * before this table existed stay suppressed.
 */

import { prisma } from "@/lib/prisma";

/** Standard Twilio/CTIA opt-out keywords. Matched on the first word only. */
const STOP_KEYWORDS = new Set([
  "stop",
  "stopall",
  "unsubscribe",
  "cancel",
  "end",
  "quit",
  "optout",
  "revoke",
]);

/** Standard opt-in / re-subscribe keywords. */
const START_KEYWORDS = new Set(["start", "unstop", "yes", "optin"]);

/** Standard help keywords. */
const HELP_KEYWORDS = new Set(["help", "info"]);

export type SmsKeyword = "stop" | "start" | "help" | null;

/**
 * Normalize a phone to E.164 (+1XXXXXXXXXX for US). Returns null when the input
 * can't be made into something we can compare. Mirrors lib/wd/messaging toE164
 * but is the version the compliance layer trusts.
 */
export function normalizePhone(raw?: string | null): string | null {
  if (!raw) return null;
  const trimmed = String(raw).trim();
  if (!trimmed) return null;
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (trimmed.startsWith("+") && digits.length >= 8) return `+${digits}`;
  return null;
}

/**
 * Classify an inbound SMS body against the compliance keywords.
 *
 * Deliberately lenient: carriers and humans send "STOP.", "stop please",
 * "Stop!", "  STOP  ". We normalize (trim, lowercase, strip punctuation) and
 * match on the FIRST word, so any message that opens with a keyword counts.
 */
export function classifySmsKeyword(body?: string | null): SmsKeyword {
  if (!body) return null;
  const normalized = body
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .trim();
  if (!normalized) return null;

  const first = normalized.split(/\s+/)[0];
  if (STOP_KEYWORDS.has(first)) return "stop";
  if (START_KEYWORDS.has(first)) return "start";
  if (HELP_KEYWORDS.has(first)) return "help";
  return null;
}

/**
 * Has this number opted out of SMS?
 *
 * Fail closed — an unreadable ledger or an unparseable phone returns true.
 * Callers must skip the send (and log) when this is true.
 */
export async function isOptedOut(phone?: string | null): Promise<boolean> {
  const e164 = normalizePhone(phone);
  if (!e164) {
    console.warn("[sms-optout] unparseable phone, refusing send:", phone);
    return true;
  }

  try {
    const record = await prisma.smsOptOut.findUnique({ where: { phone: e164 } });
    if (record) return record.optedOut;

    // Legacy signal: opt-outs recorded on the conversation before SmsOptOut.
    const legacy = await prisma.smsConversation.findFirst({
      where: { phoneNumber: { endsWith: e164.slice(-10) }, status: "opted_out" },
      select: { id: true },
    });
    return legacy !== null;
  } catch (err) {
    console.error("[sms-optout] lookup failed — failing closed for", e164, err);
    return true;
  }
}

/** Record an opt-out. Idempotent. Returns the E.164 stored, or null if unusable. */
export async function recordOptOut(
  phone: string,
  opts: { keyword?: string; source?: string; body?: string } = {}
): Promise<string | null> {
  const e164 = normalizePhone(phone);
  if (!e164) {
    console.warn("[sms-optout] cannot record opt-out for unparseable phone:", phone);
    return null;
  }

  const data = {
    optedOut: true,
    source: opts.source ?? "sms_keyword",
    keyword: opts.keyword ?? null,
    lastBody: opts.body?.slice(0, 500) ?? null,
    optedOutAt: new Date(),
  };

  await prisma.smsOptOut.upsert({
    where: { phone: e164 },
    create: { phone: e164, ...data },
    update: data,
  });

  // Keep the conversation view consistent with the ledger.
  await prisma.smsConversation.updateMany({
    where: { phoneNumber: { endsWith: e164.slice(-10) } },
    data: { status: "opted_out" },
  });

  return e164;
}

/** Record an explicit re-subscribe (START/UNSTOP/YES only). */
export async function recordOptIn(
  phone: string,
  opts: { keyword?: string; source?: string } = {}
): Promise<string | null> {
  const e164 = normalizePhone(phone);
  if (!e164) return null;

  const data = {
    optedOut: false,
    source: opts.source ?? "sms_keyword",
    keyword: opts.keyword ?? null,
    optedInAt: new Date(),
  };

  await prisma.smsOptOut.upsert({
    where: { phone: e164 },
    create: { phone: e164, ...data },
    update: data,
  });

  await prisma.smsConversation.updateMany({
    where: { phoneNumber: { endsWith: e164.slice(-10) }, status: "opted_out" },
    data: { status: "active" },
  });

  return e164;
}

/** Thrown by sendSms when the recipient is suppressed. */
export class SmsOptedOutError extends Error {
  readonly phone: string;
  constructor(phone: string) {
    super(`recipient ${phone} has opted out of SMS`);
    this.name = "SmsOptedOutError";
    this.phone = phone;
  }
}
