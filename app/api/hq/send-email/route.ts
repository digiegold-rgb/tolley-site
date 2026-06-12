import { NextRequest, NextResponse } from "next/server";

import { sendPlainEmail } from "@/lib/leads/email-transport";

export const runtime = "nodejs";

/**
 * POST /api/hq/send-email — send ONE plain-text personal email from the
 * Jared/leads identity (EMAIL_LEADS_FROM). Used by the listing-engine direct
 * sender (growth-engine/outbound/send-approved-direct.mjs); deliberately
 * plain text — it reads more personal than HTML.
 *
 * Auth: x-sync-secret header. Body: { to, subject, body }.
 */
export async function POST(request: NextRequest) {
  const syncSecret = process.env.SYNC_SECRET;
  const authHeader = request.headers.get("x-sync-secret");
  if (!syncSecret || authHeader !== syncSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { to, subject, body } = (payload ?? {}) as {
    to?: unknown;
    subject?: unknown;
    body?: unknown;
  };

  if (typeof to !== "string" || !to.includes("@")) {
    return NextResponse.json({ error: "to (email) required" }, { status: 400 });
  }
  if (typeof subject !== "string" || !subject.trim()) {
    return NextResponse.json({ error: "subject required" }, { status: 400 });
  }
  if (typeof body !== "string" || !body.trim()) {
    return NextResponse.json({ error: "body required" }, { status: 400 });
  }

  try {
    await sendPlainEmail({ to, subject, text: body });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown";
    console.error("[hq/send-email] SMTP error:", msg);
    return NextResponse.json({ error: `Send failed: ${msg}` }, { status: 500 });
  }

  return NextResponse.json({ ok: true, to, subject });
}
