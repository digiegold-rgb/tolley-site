/**
 * POST /api/vater/invite-request — public (signed-out) "Request an invite" form
 * on the /animate landing. Files an /hq INBOX lead (LeadAction subsite
 * "animate" / action "invite-request" — Jared 8/16: "I want them in the inbox,
 * not Must Complete"), emails the requester an instant ack, pings Telegram.
 * Approval = the inbox row's "Approve → mint + email invite" button.
 * No auth; rate-limited per IP; honeypot field.
 */
import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { rateLimitByIp } from "@/lib/rate-limit";
import { notifyTelegram } from "@/lib/budget/notify";
import { sendInviteRequestAck } from "@/lib/vater/animate-email";

export const runtime = "nodejs";

function str(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t ? t.slice(0, max) : null;
}
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export async function POST(request: NextRequest) {
  const limited = await rateLimitByIp(request, "vater:invite-request", 5, 3600);
  if (limited) return limited;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  // Honeypot: bots fill every field.
  if (str(body.website, 10)) return NextResponse.json({ ok: true });

  const email = str(body.email, 200)?.toLowerCase() ?? null;
  const name = str(body.name, 120);
  const about = str(body.about, 600);
  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "A valid email is required." }, { status: 400 });
  }

  try {
    // Dedup: one open inbox row per address (re-submits just bump nothing).
    const existing = await prisma.leadAction.findFirst({
      where: { subsite: "animate", action: "invite-request", email, status: { notIn: ["won", "lost"] } },
      select: { id: true },
    });
    if (!existing) {
      await prisma.leadAction.create({
        data: {
          receiptToken: crypto.randomBytes(8).toString("base64url"),
          subsite: "animate",
          action: "invite-request",
          email,
          name,
          structured: { about: about ?? "", source: "animate-landing" },
          status: "new",
        },
      });
    }
  } catch (err) {
    console.error("[vater/invite-request] inbox write failed", err);
    return NextResponse.json({ error: "Could not send your request. Email jared@yourkchomes.com." }, { status: 500 });
  }

  // Auto-ack so the requester never sits in silence (Jared 8/16). Failure is
  // logged, never surfaced — the request itself is already filed.
  let acked = false;
  try {
    await sendInviteRequestAck(email, name);
    acked = true;
  } catch (err) {
    console.error("[vater/invite-request] ack email failed", err);
  }

  try {
    await notifyTelegram(`📨 Jelly invite request: ${email}${name ? ` (${name})` : ""}${about ? ` — ${about.slice(0, 120)}` : ""} → /hq Inbox (Approve → mint + email) https://www.tolley.io/hq${acked ? "" : " ⚠️ ack email FAILED"}`);
  } catch {
    /* never fail the user on a Telegram hiccup */
  }
  return NextResponse.json({ ok: true });
}
