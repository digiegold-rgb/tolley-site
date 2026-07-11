/**
 * POST /api/instantly/webhook?secret=…
 *
 * Inbound webhook from Instantly.ai for the VIDEO outreach campaign. We only
 * act on reply events (event_type containing "reply", e.g. "reply_received"):
 * log the reply as an inbound GrowthTouch, bump the lead demo_built/contacted
 * → replied, and ping Telegram so Cordless jumps on it in /hq.
 *
 * Auth: shared secret compared constant-time against
 * INSTANTLY_WEBHOOK_SECRET. Preferred transport is the `x-instantly-secret`
 * header (set it in Instantly's webhook config if custom headers are
 * supported there); `?secret=` query param is the fallback for webhook UIs
 * that only take a URL — note query strings can land in proxy/deploy logs,
 * so use the header when possible. Unknown event types / unmatched emails return
 * 200 { ok, skipped } — never 500 a webhook for events we simply don't
 * handle (Instantly would retry forever). Real processing failures DO 500 so
 * the retry has a chance to land.
 *
 * Instantly's webhook payload shape is loosely documented — every field read
 * below is defensive (multiple candidate keys).
 */

import { createHash, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { addToBlocklist } from "@/lib/instantly";
import { notifyTelegram } from "@/lib/budget/notify";

// Conservative opt-out phrases — a match flips the lead to do_not_contact and
// blocks the email workspace-wide in Instantly. Deliberately excludes bare
// "stop"/"no" to avoid false positives in normal replies.
const OPT_OUT_PHRASES = [
  "unsubscribe",
  "remove me",
  "take me off",
  "opt me out",
  "opt out",
  "do not contact",
  "don't contact",
  "dont contact",
  "stop emailing",
  "stop contacting",
  "no longer contact",
  "not interested",
  "no thanks",
];

function isOptOut(text: string | null): boolean {
  if (!text) return false;
  const t = text.toLowerCase();
  return OPT_OUT_PHRASES.some((p) => t.includes(p));
}

export const runtime = "nodejs";

function secretMatches(provided: string, expected: string): boolean {
  // Hash both sides to fixed length so timingSafeEqual never throws on
  // length mismatch (and the comparison stays constant-time).
  const a = createHash("sha256").update(provided).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

export async function POST(request: NextRequest) {
  const expected = process.env.INSTANTLY_WEBHOOK_SECRET;
  if (!expected) {
    console.error("[instantly/webhook] INSTANTLY_WEBHOOK_SECRET not set");
    return NextResponse.json(
      { error: "Webhook secret not configured" },
      { status: 500 }
    );
  }

  const provided =
    request.headers.get("x-instantly-secret") ||
    request.nextUrl.searchParams.get("secret") ||
    "";
  if (!secretMatches(provided, expected)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const eventType =
    str(body.event_type) || str(body.eventType) || str(body.event) || "";

  // Be liberal: any event type mentioning "reply" counts (reply_received,
  // lead_replied, reply, …). Everything else is acknowledged + skipped.
  if (!eventType.toLowerCase().includes("reply")) {
    console.log(`[instantly/webhook] skipping non-reply event "${eventType || "(none)"}"`);
    return NextResponse.json({ ok: true, skipped: "non-reply event type" });
  }

  const leadObj = (body.lead || {}) as Record<string, unknown>;
  const email =
    str(body.lead_email) ||
    str(body.email) ||
    str(leadObj.email) ||
    str(body.to_email);
  if (!email) {
    console.log("[instantly/webhook] reply event with no lead email", eventType);
    return NextResponse.json({ ok: true, skipped: "no lead email in payload" });
  }

  const subject =
    str(body.reply_subject) ||
    str(body.subject) ||
    str(body.email_subject) ||
    "Reply via Instantly";
  const replyBody =
    str(body.reply_text) ||
    str(body.reply_text_snippet) ||
    str(body.body) ||
    str(body.text) ||
    str(body.reply_html) ||
    null;

  try {
    // Prefer the video-offer lead for this email, fall back to any lead.
    const lead =
      (await prisma.growthLead.findFirst({
        where: {
          offer: "video",
          email: { equals: email, mode: "insensitive" },
        },
      })) ||
      (await prisma.growthLead.findFirst({
        where: { email: { equals: email, mode: "insensitive" } },
      }));

    if (!lead) {
      console.log(`[instantly/webhook] reply from unknown email ${email}`);
      return NextResponse.json({ ok: true, skipped: "no matching GrowthLead" });
    }

    await prisma.growthTouch.create({
      data: {
        leadId: lead.id,
        channel: "email",
        direction: "in",
        status: "received",
        subject,
        body: replyBody,
        meta: { source: "instantly", eventType },
      },
    });

    const optedOut = isOptOut(replyBody) || isOptOut(subject);

    if (optedOut) {
      // Honor it everywhere: our pipeline (stage gates every send path) AND
      // Instantly's workspace blocklist (survives lead re-imports).
      await prisma.growthLead.update({
        where: { id: lead.id },
        data: { stage: "do_not_contact" },
      });
      try {
        await addToBlocklist(email);
      } catch (err) {
        // Stage flip already protects our side; blocklist is belt-and-braces.
        console.error("[instantly/webhook] blocklist add failed (non-fatal)", err);
      }
    } else if (lead.stage === "demo_built" || lead.stage === "contacted") {
      // Only advance forward — never demote a booked/client lead to "replied".
      await prisma.growthLead.update({
        where: { id: lead.id },
        data: { stage: "replied" },
      });
    }

    const tg = await notifyTelegram(
      optedOut
        ? `🚫 Opt-out honored: ${lead.name} (${email}) — moved to Do Not Contact + Instantly blocklist`
        : `📩 Lead replied: ${lead.name} — check /hq`
    );
    if (!tg.ok) {
      console.warn("[instantly/webhook] telegram notify failed (non-fatal):", tg.error);
    }

    return NextResponse.json({ ok: true, leadId: lead.id });
  } catch (err) {
    console.error("[instantly/webhook] processing failed", err);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
