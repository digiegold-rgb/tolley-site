import { NextRequest, NextResponse } from "next/server";

import { loadInbox } from "@/lib/sms-inbox-data";
import { createWdDraft, last10Digits, toE164 } from "@/lib/wd/messaging";
import { validateWdAdmin } from "@/lib/wd-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/hq/sms — thread list for the Growth HQ SMS inbox.
 * Same PIN cookie as the rest of /hq (validateWdAdmin).
 */
export async function GET() {
  const { authed } = await validateWdAdmin();
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { threads, counts } = await loadInbox();
    return NextResponse.json({ threads, counts });
  } catch (err) {
    console.error("[hq/sms GET]", err);
    return NextResponse.json({ error: "Failed to load SMS inbox" }, { status: 500 });
  }
}

/**
 * POST /api/hq/sms — create an outbound draft. Does NOT send.
 * Send is POST /api/wd/messages/[id] (same 1-tap path as /wd/admin).
 */
export async function POST(request: NextRequest) {
  const { authed } = await validateWdAdmin();
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: { phone?: unknown; body?: unknown; clientId?: unknown };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const body = typeof payload.body === "string" ? payload.body.trim() : "";
  if (!body) {
    return NextResponse.json({ error: "body required" }, { status: 400 });
  }

  const rawPhone = typeof payload.phone === "string" ? payload.phone : "";
  const phone = toE164(rawPhone);
  if (!phone || !last10Digits(phone)) {
    return NextResponse.json({ error: "valid phone required" }, { status: 400 });
  }

  const clientId = typeof payload.clientId === "string" && payload.clientId ? payload.clientId : null;

  try {
    const id = await createWdDraft({
      clientId,
      phone,
      channel: "sms",
      kind: "manual",
      direction: "outbound",
      status: "draft",
      body,
      aiGenerated: false,
    });
    return NextResponse.json({ ok: true, id });
  } catch (err) {
    console.error("[hq/sms POST]", err);
    return NextResponse.json({ error: "Failed to save draft" }, { status: 500 });
  }
}
