import { NextRequest, NextResponse } from "next/server";

import { validateWdAdmin } from "@/lib/wd-auth";
import { getTwilioClient } from "@/lib/twilio";
import { WD_AGENT_E164, WD_VOICE_E164, cleanDialName, parseDialTarget } from "@/lib/wd/call-numbers";
import { DIAL_TOKEN_TTL_SEC, signDialTicket, twilioWebhookUrl } from "@/lib/wd/click-to-call";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * POST /api/wd/call
 *
 * Owner session only. Rings Jared's cell from the Wash & Dry number.
 * The TwiML url is per-call — it does not change the number's Voice webhook.
 */
export async function POST(request: NextRequest) {
  const { authed } = await validateWdAdmin();
  if (!authed) {
    return NextResponse.json(
      { error: "Sign in with your owner account.", loginUrl: "/login?callbackUrl=%2Fwd%2Fcall" },
      { status: 401 },
    );
  }

  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
    return NextResponse.json({ error: "Twilio is not configured on this server." }, { status: 503 });
  }
  const secret = process.env.AUTH_SECRET || "";
  if (!secret) {
    return NextResponse.json({ error: "Call bridge is not configured." }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Enter a 10-digit US number." }, { status: 400 });
  }
  const record = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const rawPhone = typeof record.phone === "string" ? record.phone.slice(0, 32) : "";
  const target = parseDialTarget(rawPhone);
  if (!target.ok) {
    return NextResponse.json({ error: target.error }, { status: 400 });
  }

  const name = cleanDialName(record.name);
  const exp = Math.floor(Date.now() / 1000) + DIAL_TOKEN_TTL_SEC;
  const token = signDialTicket({ to: target.phone, name, exp }, secret);
  const url = twilioWebhookUrl(`/api/wd/voice/bridge?t=${token}`);

  try {
    const call = await getTwilioClient().calls.create({
      to: WD_AGENT_E164,
      from: WD_VOICE_E164,
      url,
      method: "POST",
      timeout: 25,
    });
    console.info("[wd-call] ringing agent", { sid: call.sid, tenantLast4: target.phone.slice(-4) });
    return NextResponse.json({
      ok: true,
      callSid: call.sid,
      message: "Your phone is ringing. Answer it and we will connect the tenant.",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message.slice(0, 180) : "Twilio could not place the call.";
    console.error("[wd-call] create failed", message);
    return NextResponse.json({ error: message || "Twilio could not place the call." }, { status: 502 });
  }
}
