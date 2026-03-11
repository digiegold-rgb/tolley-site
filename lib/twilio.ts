import twilio from "twilio";

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
 */
export async function sendSms(to: string, body: string): Promise<string> {
  const tw = getTwilioClient();
  const from = getTwilioPhone();

  // Truncate to ~1600 chars (standard SMS concatenation limit)
  const truncated = body.length > 1580 ? body.slice(0, 1577) + "..." : body;

  const msg = await tw.messages.create({
    to,
    from,
    body: truncated,
  });

  return msg.sid;
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
