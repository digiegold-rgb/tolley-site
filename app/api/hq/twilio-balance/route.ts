import { NextResponse } from "next/server";

import {
  fetchTwilioBalance,
  TwilioBalanceConfigError,
  TwilioBalanceUpstreamError,
} from "@/lib/twilio-balance";
import { validateWdAdmin } from "@/lib/wd-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "private, no-store" } as const;

/**
 * GET /api/hq/twilio-balance — live prepaid SMS balance for the Money + SMS
 * tabs. PIN cookie only (same as every other /api/hq route). Returns
 * { balance, currency, asOf } — never Account SID or Auth Token.
 */
export async function GET() {
  const { authed } = await validateWdAdmin();
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE });
  }

  try {
    const payload = await fetchTwilioBalance();
    return NextResponse.json(payload, { headers: NO_STORE });
  } catch (err) {
    if (err instanceof TwilioBalanceConfigError) {
      return NextResponse.json({ error: err.message }, { status: err.status, headers: NO_STORE });
    }
    if (err instanceof TwilioBalanceUpstreamError) {
      return NextResponse.json({ error: err.message }, { status: err.status, headers: NO_STORE });
    }
    // No err dump — Twilio error bodies can mention the Account SID.
    console.error("[hq/twilio-balance GET] failed");
    return NextResponse.json(
      { error: "Failed to load Twilio balance" },
      { status: 502, headers: NO_STORE },
    );
  }
}
