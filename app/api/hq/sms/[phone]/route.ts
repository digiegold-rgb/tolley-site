import { NextRequest, NextResponse } from "next/server";

import { loadInboxThread } from "@/lib/sms-inbox-data";
import { last10Digits } from "@/lib/wd/messaging";
import { validateWdAdmin } from "@/lib/wd-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/hq/sms/[phone] — one conversation, inbound + outbound in order. */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ phone: string }> },
) {
  const { authed } = await validateWdAdmin();
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { phone } = await params;
  const key = last10Digits(decodeURIComponent(phone));
  if (!key) {
    return NextResponse.json({ error: "valid phone required" }, { status: 400 });
  }

  try {
    const data = await loadInboxThread(key);
    if (!data) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(data);
  } catch (err) {
    console.error("[hq/sms/:phone GET]", err);
    return NextResponse.json({ error: "Failed to load thread" }, { status: 500 });
  }
}
