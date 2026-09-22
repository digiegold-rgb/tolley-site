import { NextRequest, NextResponse } from "next/server";

import { dialTwiml } from "@/lib/wd/click-to-call";
import { authorizedBridgeTicket, twimlResponse } from "@/lib/wd/voice-request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/wd/voice/dial?t=TOKEN
 *
 * TwiML that dials the tenant. <Dial callerId="+19136007508"> is the From
 * they see. The number comes from the signed token, never from the POST body.
 */
export async function POST(request: NextRequest) {
  const gate = await authorizedBridgeTicket(request);
  if (!gate.ok) return gate.response;
  return twimlResponse(dialTwiml(gate.ticket.to));
}

export function GET() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}
