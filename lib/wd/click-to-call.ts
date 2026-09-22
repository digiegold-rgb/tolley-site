/**
 * Click-to-call bridge for Wash & Dry.
 *
 * Jared taps a number on /wd/call. We place ONE outbound call to his cell
 * from +19136007508. When he answers, Twilio fetches /api/wd/voice/bridge?t=,
 * which redirects to /api/wd/voice/dial?t=. That TwiML <Dial callerId> is the
 * From the tenant sees.
 *
 * This does not read or write the phone number's Voice webhook. Inbound
 * calls to +19136007508 keep whatever forward is set in the Twilio console.
 */

import { createHmac } from "node:crypto";

import { formatPhoneDisplay, last10Digits } from "@/lib/phone";
import { secretEquals } from "@/lib/secret-compare";
import { publicSiteUrl } from "@/lib/vater/site-url";

import {
  WD_AGENT_E164,
  WD_QUICK_DIALS,
  WD_VOICE_E164,
  cleanDialName,
  normalizeDialNumber,
  parseDialTarget,
  type DialContact,
} from "./call-numbers";

export { cleanDialName, normalizeDialNumber, parseDialTarget };

/** Long enough for Jared to pick up; short enough that a leaked URL dies. */
export const DIAL_TOKEN_TTL_SEC = 15 * 60;

export type DialTicket = {
  to: string;
  name: string;
  exp: number;
};

export type { DialContact };

const TOKEN_RE = /^[A-Za-z0-9_-]+~[A-Za-z0-9_-]+$/;

export function signDialTicket(ticket: DialTicket, secret: string): string {
  if (!secret) throw new Error("Missing AUTH_SECRET");
  const body: DialTicket = {
    to: ticket.to,
    name: cleanDialName(ticket.name),
    exp: ticket.exp,
  };
  const payload = Buffer.from(JSON.stringify(body), "utf8").toString("base64url");
  const sig = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}~${sig}`;
}

export function readDialTicket(token: string, secret: string, nowSec = Math.floor(Date.now() / 1000)): DialTicket | null {
  if (!secret || !TOKEN_RE.test(token)) return null;
  const split = token.indexOf("~");
  const payload = token.slice(0, split);
  const sig = token.slice(split + 1);
  const expected = createHmac("sha256", secret).update(payload).digest("base64url");
  if (!secretEquals(sig, expected)) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const row = parsed as Partial<DialTicket>;
  if (typeof row.to !== "string" || typeof row.exp !== "number" || !Number.isFinite(row.exp)) return null;
  if (nowSec > row.exp) return null;
  const target = parseDialTarget(row.to);
  if (!target.ok || target.phone !== row.to) return null;
  return { to: target.phone, name: cleanDialName(row.name), exp: row.exp };
}

/**
 * The REST call we place is From the Wash & Dry number To Jared's cell.
 * An inbound call to the Wash & Dry number looks the opposite way and is rejected,
 * so pointing the number's Voice webhook at these routes would not bridge tenants.
 */
export function isJaredBridgeLeg(params: Record<string, string>): boolean {
  const to = last10Digits(params.To) || last10Digits(params.Called);
  const from = last10Digits(params.From) || last10Digits(params.Caller);
  return to === last10Digits(WD_AGENT_E164) && from === last10Digits(WD_VOICE_E164);
}

export function xmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function twilioWebhookUrl(pathname: string): string {
  const path = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return `${publicSiteUrl()}${path}`;
}

/** TwiML Twilio fetches when Jared answers. Does not dial the tenant. */
export function bridgeTwiml(dialUrl: string, name: string): string {
  const who = cleanDialName(name);
  const say = who ? `Connecting you to ${who}.` : "Connecting.";
  return `<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="alice">${xmlEscape(say)}</Say><Redirect method="POST">${xmlEscape(dialUrl)}</Redirect></Response>`;
}

/**
 * TwiML that dials the tenant. callerId is the From they see.
 * answerOnBridge keeps Jared on ringback until the tenant picks up.
 */
export function dialTwiml(tenantE164: string): string {
  const tenant = xmlEscape(tenantE164);
  const from = xmlEscape(WD_VOICE_E164);
  return `<?xml version="1.0" encoding="UTF-8"?><Response><Dial callerId="${from}" timeout="30" answerOnBridge="true"><Number>${tenant}</Number></Dial><Say voice="alice">The call has ended.</Say><Hangup/></Response>`;
}

export function rejectTwiml(): string {
  return `<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="alice">This call cannot be connected.</Say><Hangup/></Response>`;
}

export function mergeDialContacts(
  rows: { id: string; name: string; phone: string | null; address?: string | null; active?: boolean }[],
): DialContact[] {
  const out: DialContact[] = [];
  const seen = new Set<string>();

  const push = (id: string, name: string, raw: string | null | undefined, detail: string, quick: boolean) => {
    const phone = normalizeDialNumber(raw);
    if (!phone || !parseDialTarget(phone).ok || seen.has(phone)) return;
    seen.add(phone);
    out.push({
      id,
      name: cleanDialName(name) || formatPhoneDisplay(phone),
      phone,
      detail: detail.slice(0, 80),
      quick,
    });
  };

  for (const quick of WD_QUICK_DIALS) {
    push(`quick:${quick.phone}`, quick.name, quick.phone, "Quick dial", true);
  }
  for (const row of rows) {
    const bits = [row.active === false ? "Inactive" : "", row.address?.trim() || ""].filter(Boolean);
    push(row.id, row.name, row.phone, bits.join(" · "), false);
  }
  return out;
}
