import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { validateWdAdmin } from "@/lib/wd-auth";
import { sendPlainEmail } from "@/lib/leads/email-transport";

export const runtime = "nodejs";

// POST /api/hq/inbound/[id]/reply — send ONE personal reply to an inbound
// lead, from the Jared/leads identity. Only fires from the /hq Inbox UI
// behind the WD admin PIN — a human taps every send. Body: { subject, body }.
// On success the lead advances to "contacted" with a note of what was sent.
export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { authed } = await validateWdAdmin();
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  let payload: { subject?: unknown; body?: unknown };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const subject = typeof payload.subject === "string" ? payload.subject.trim() : "";
  const body = typeof payload.body === "string" ? payload.body.trim() : "";
  if (!subject) return NextResponse.json({ error: "subject required" }, { status: 400 });
  if (!body) return NextResponse.json({ error: "body required" }, { status: 400 });
  if (body.length > 10_000) {
    return NextResponse.json({ error: "body too long" }, { status: 400 });
  }

  // Prefixed ids route to the merged inbound sources (see ../../route.ts).
  let email: string | null = null;
  try {
    if (id.startsWith("email_")) {
      const row = await prisma.emailLead.findUnique({
        where: { id: id.slice("email_".length) },
      });
      email = row?.email ?? null;
    } else if (id.startsWith("portal_")) {
      const row = await prisma.clientPortalSignup.findUnique({
        where: { id: id.slice("portal_".length) },
      });
      email = row?.email ?? null;
    } else {
      const row = await prisma.leadAction.findUnique({ where: { id } });
      email = row?.email ?? null;
    }
  } catch (err) {
    console.error("[hq/inbound/reply] lookup failed", err);
  }
  if (!email || !email.includes("@")) {
    return NextResponse.json(
      { error: "Lead not found or has no email — call or text instead" },
      { status: 404 },
    );
  }

  try {
    await sendPlainEmail({ to: email, subject, text: body });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown";
    console.error("[hq/inbound/reply] SMTP error:", msg);
    return NextResponse.json({ error: "Email send failed" }, { status: 500 });
  }

  const data = {
    status: "contacted",
    statusNote: `Replied ${new Date().toISOString().slice(0, 10)}: "${subject}"`,
    statusUpdatedAt: new Date(),
  };
  try {
    if (id.startsWith("email_")) {
      await prisma.emailLead.update({ where: { id: id.slice("email_".length) }, data });
    } else if (id.startsWith("portal_")) {
      await prisma.clientPortalSignup.update({
        where: { id: id.slice("portal_".length) },
        data,
      });
    } else {
      await prisma.leadAction.update({ where: { id }, data });
    }
  } catch (err) {
    // Send succeeded; a status bump failing shouldn't read as a failed send.
    console.error("[hq/inbound/reply] status update failed after send", err);
  }

  return NextResponse.json({ ok: true, to: email });
}
