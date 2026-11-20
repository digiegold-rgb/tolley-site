import { recordLeadCustomer } from "@/lib/customer-history/store";
/**
 * POST /api/net/quote — public consult form on /net.
 *
 * Mirrors /api/cleanouts/quote: a GrowthLead plus a Telegram alert committed
 * in the same transaction and delivered after the response. This route is
 * separate because the cleanouts handler hardcodes the cleanout offer and
 * its ad-conversion payload. Source is tolley-net and offer is net.
 *
 * A name, a 7-digit phone number, or a valid email is required. Anything
 * else on the form can be missing and the lead is still saved.
 */

import { NextRequest, NextResponse, after } from "next/server";

import { normalizeAttribution } from "@/lib/discovery-attribution";
import { prisma } from "@/lib/prisma";
import { consumeRateLimit, rateLimited } from "@/lib/rate-limit";
import { deliverLeadNotifications, enqueueNetNotification } from "@/lib/lead-notification-outbox";
import { parseNetQuote } from "@/lib/net";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rl = await consumeRateLimit(`net-quote:${ip}`, 5, 3600);
  if (!rl.allowed) return rateLimited(rl);

  let body: Record<string, unknown> = {};
  try {
    const parsed = await request.json();
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) body = parsed as Record<string, unknown>;
  } catch (err) {
    console.error("[net/quote] unparseable body:", err);
  }

  const parsed = parseNetQuote(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  const quote = parsed.value;
  const attribution = {
    ...(normalizeAttribution(body.attribution) ?? {}),
    source: "tolley-net",
    offer: "net",
    gaming: quote.gaming,
    ...(quote.devices ? { devices: quote.devices } : {}),
    ...(quote.preferredTime ? { preferredTime: quote.preferredTime } : {}),
  };

  const lead = await prisma.$transaction(async (tx) => {
    const created = await tx.growthLead.create({
      data: {
        name: quote.name || `Net quote ${new Date().toISOString().slice(0, 10)}`,
        offer: "net",
        source: "tolley-net",
        attribution,
        stage: "replied",
        phone: quote.phone || null,
        email: quote.email || null,
        city: quote.city || null,
        notes: quote.notes || null,
      },
    });
    await recordLeadCustomer(tx, "growth", created, { sessionId: body.sessionId });
    await enqueueNetNotification(tx, created.id, { name: quote.name, phone: quote.phone, city: quote.city });
    return created;
  });

  after(() => deliverLeadNotifications(lead.id));

  return NextResponse.json({ ok: true, leadId: lead.id });
}
