/**
 * Server-only Twilio account balance. Uses the same TWILIO_ACCOUNT_SID /
 * TWILIO_AUTH_TOKEN env vars as sendSms. Never returns or logs the SID/token.
 * HQ client UI must not import this file — copy the two public constants
 * (threshold + Console URL) in the component instead.
 */

export const TWILIO_LOW_BALANCE_USD = 5;
export const TWILIO_CONSOLE_BILLING_URL =
  "https://console.twilio.com/us1/billing/manage-billing/billing-overview";

export type TwilioBalance = {
  balance: number;
  currency: string;
  asOf: string;
};

export class TwilioBalanceConfigError extends Error {
  readonly status = 503 as const;
  constructor(message = "Twilio is not configured") {
    super(message);
    this.name = "TwilioBalanceConfigError";
  }
}

export class TwilioBalanceUpstreamError extends Error {
  readonly status = 502 as const;
  constructor(message = "Twilio balance unavailable") {
    super(message);
    this.name = "TwilioBalanceUpstreamError";
  }
}

/** Twilio returns `balance` as a string. Drop account_sid — never send it out. */
export function parseTwilioBalanceResponse(
  raw: unknown,
  asOf: Date = new Date(),
): TwilioBalance {
  if (!raw || typeof raw !== "object") {
    throw new TwilioBalanceUpstreamError("Twilio returned an invalid balance");
  }
  const rec = raw as Record<string, unknown>;
  const n = typeof rec.balance === "number" ? rec.balance : Number(rec.balance);
  const currency = typeof rec.currency === "string" ? rec.currency.trim() : "";
  if (!Number.isFinite(n) || !currency) {
    throw new TwilioBalanceUpstreamError("Twilio returned an invalid balance");
  }
  return { balance: n, currency, asOf: asOf.toISOString() };
}

export function isLowTwilioBalance(balance: number): boolean {
  return balance < TWILIO_LOW_BALANCE_USD;
}

function getTwilioBalanceCredentials(): { sid: string; token: string } {
  const sid = process.env.TWILIO_ACCOUNT_SID?.trim() ?? "";
  const token = process.env.TWILIO_AUTH_TOKEN?.trim() ?? "";
  if (!sid || !token) {
    throw new TwilioBalanceConfigError("Twilio is not configured");
  }
  return { sid, token };
}

export async function fetchTwilioBalance(): Promise<TwilioBalance> {
  const { sid, token } = getTwilioBalanceCredentials();
  const url = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Balance.json`;
  const auth = Buffer.from(`${sid}:${token}`, "utf8").toString("base64");

  let res: Response;
  try {
    res = await fetch(url, {
      method: "GET",
      headers: { Authorization: `Basic ${auth}` },
      cache: "no-store",
    });
  } catch {
    // Do not log the URL (it contains the Account SID) or the auth header.
    throw new TwilioBalanceUpstreamError("Could not reach Twilio");
  }

  if (!res.ok) {
    throw new TwilioBalanceUpstreamError("Twilio balance request failed");
  }

  let json: unknown;
  try {
    json = await res.json();
  } catch {
    throw new TwilioBalanceUpstreamError("Twilio returned an invalid balance");
  }

  return parseTwilioBalanceResponse(json);
}
