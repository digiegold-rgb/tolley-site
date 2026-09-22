import { NextRequest, NextResponse } from "next/server";

import { validateTwilioSignature } from "@/lib/twilio";
import { publicSiteUrl } from "@/lib/vater/site-url";

import { isJaredBridgeLeg, readDialTicket, rejectTwiml, type DialTicket } from "./click-to-call";

export function twimlResponse(xml: string, status = 200): NextResponse {
  return new NextResponse(xml, {
    status,
    headers: {
      "Content-Type": "text/xml; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

export async function readTwilioParams(request: NextRequest): Promise<Record<string, string>> {
  const form = await request.formData();
  const params: Record<string, string> = {};
  for (const [key, value] of form.entries()) {
    if (typeof value === "string") params[key] = value;
  }
  return params;
}

/**
 * Fail closed. Twilio signs the public URL we passed to calls.create, which
 * can differ from the host header on the way in.
 */
export function twilioSignatureOk(request: NextRequest, params: Record<string, string>): boolean {
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!authToken) return false;
  const signature = request.headers.get("x-twilio-signature") || "";
  if (!signature) return false;
  const url = `${publicSiteUrl()}${request.nextUrl.pathname}${request.nextUrl.search}`;
  return validateTwilioSignature(url, params, signature);
}

export async function authorizedBridgeTicket(
  request: NextRequest,
): Promise<{ ok: true; ticket: DialTicket; token: string } | { ok: false; response: NextResponse }> {
  const token = request.nextUrl.searchParams.get("t") || "";
  let params: Record<string, string>;
  try {
    params = await readTwilioParams(request);
  } catch {
    return { ok: false, response: NextResponse.json({ error: "Invalid signature" }, { status: 403 }) };
  }
  if (!twilioSignatureOk(request, params)) {
    return { ok: false, response: NextResponse.json({ error: "Invalid signature" }, { status: 403 }) };
  }
  const secret = process.env.AUTH_SECRET || "";
  const ticket = secret ? readDialTicket(token, secret) : null;
  if (!ticket || !isJaredBridgeLeg(params)) {
    return { ok: false, response: twimlResponse(rejectTwiml()) };
  }
  return { ok: true, ticket, token };
}
