/**
 * Public Wash & Dry voice numbers. These are phone numbers, not secrets.
 * The inbound Voice webhook on WD_VOICE_E164 is configured in the Twilio
 * console and is intentionally not referenced here.
 */

import { last10Digits } from "@/lib/phone";

/** Messaging / voice number tenants should see: +1 913-600-7508. */
export const WD_VOICE_E164 = "+19136007508";
export const WD_VOICE_DISPLAY = "(913) 600-7508";

/** Jared's cell. The bridge rings this first. */
export const WD_AGENT_E164 = "+19132833826";
export const WD_AGENT_DISPLAY = "(913) 283-3826";

export const WD_QUICK_DIALS = [
  { name: "Joshua Perez", phone: "+17373360266" },
] as const;

export type DialContact = {
  id: string;
  name: string;
  phone: string;
  detail: string;
  quick: boolean;
};

export function cleanDialName(name: unknown): string {
  if (typeof name !== "string") return "";
  return name.replace(/[\u0000-\u001f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 40);
}

/** US/Canada numbers only. 10 digits, or 11 with a leading 1. */
export function normalizeDialNumber(raw?: string | null): string | null {
  if (!raw) return null;
  const digits = String(raw).replace(/\D/g, "");
  const national = digits.length === 10 ? digits : digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : null;
  if (!national) return null;
  // NANP: area code and exchange cannot start with 0 or 1.
  if (national[0] === "0" || national[0] === "1") return null;
  if (national[3] === "0" || national[3] === "1") return null;
  return `+1${national}`;
}

export function parseDialTarget(
  raw?: string | null,
): { ok: true; phone: string } | { ok: false; error: string } {
  const phone = normalizeDialNumber(raw);
  if (!phone) return { ok: false, error: "Enter a 10-digit US number." };
  if (last10Digits(phone) === last10Digits(WD_AGENT_E164)) {
    return { ok: false, error: "That number is your cell. Pick the tenant." };
  }
  if (last10Digits(phone) === last10Digits(WD_VOICE_E164)) {
    return { ok: false, error: "That number is the Wash & Dry line." };
  }
  return { ok: true, phone };
}
