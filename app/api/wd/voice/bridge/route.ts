import { NextRequest, NextResponse } from "next/server";

import { bridgeTwiml, twilioWebhookUrl } from "@/lib/wd/click-to-call";
import { authorizedBridgeTicket, twimlResponse } from "@/lib/wd/voice-request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/wd/voice/bridge?t=TOKEN
 *
 * TwiML when Jared answers the outbound leg. Says who is next, then
 * redirects to the dial route. Not the number's inbound Voice webhook.
 * The signed token rides in the query string so Twilio's signature covers it.
 */
export async function POST(request: NextRequest) {
  const gate = await authorizedBridgeTicket(request);
  if (!gate.ok) return gate.response;
  const dialUrl = twilioWebhookUrl(`/api/wd/voice/dial?t=${gate.token}`);
  return twimlResponse(bridgeTwiml(dialUrl, gate.ticket.name));
}

export function GET() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}
