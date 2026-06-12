/**
 * POST /api/cleanouts/quote — public quote-request form on /cleanouts.
 *
 * Never-drop-a-lead pattern (same philosophy as /api/hq/meta-lead): minimal
 * validation, and if a field is shaky we still create the GrowthLead with
 * whatever we have. Only a completely empty submission is rejected.
 *
 * Per-IP rate limit (5/hour) keeps bots from flooding the table; Telegram
 * ping fires via after() so the response returns fast and the notification
 * isn't killed by the function freezing (feedback_vercel_after_not_fire_forget).
 */

import { NextRequest, NextResponse, after } from "next/server";

import { prisma } from "@/lib/prisma";
import { consumeRateLimit, rateLimited } from "@/lib/rate-limit";
import { notifyTelegram } from "@/lib/budget/notify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function str(v: unknown, max: number): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rl = await consumeRateLimit(`cleanout-quote:${ip}`, 5, 3600);
  if (!rl.allowed) return rateLimited(rl);

  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch (err) {
    // Never-drop: an unparseable body still falls through; the empty-submission
    // check below decides whether there is anything worth keeping.
    console.error("[cleanouts/quote] unparseable body:", err);
  }

  const name = str(body.name, 120);
  const phone = str(body.phone, 40);
  const address = str(body.address, 200);
  const details = str(body.details, 2000);

  if (!name && !phone && !address && !details) {
    return NextResponse.json(
      { error: "Tell us at least a name or phone number so we can reach you." },
      { status: 400 },
    );
  }

  const lead = await prisma.growthLead.create({
    data: {
      name: name || `Cleanout quote ${new Date().toISOString().slice(0, 10)}`,
      offer: "cleanout",
      source: "cleanouts-page",
      stage: "replied",
      phone: phone || null,
      address: address || null,
      notes: details || null,
    },
  });

  after(async () => {
    const msg =
      `🧹 Cleanout quote request: ${name || "(no name)"} ${phone || "(no phone)"}` +
      `${address ? ` — ${address}` : ""}`;
    const sent = await notifyTelegram(msg);
    if (!sent.ok) {
      console.error(`[cleanouts/quote] Telegram notify failed for lead ${lead.id}: ${sent.error}`);
    }
  });

  return NextResponse.json({ ok: true, leadId: lead.id });
}
