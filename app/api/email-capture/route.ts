import { NextResponse, after } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { enqueueLeadNotifications, deliverLeadNotifications } from "@/lib/lead-notification-outbox";
import { rateLimitByIp } from "@/lib/rate-limit";
import { sendEstateAddressIfRevealed } from "@/lib/estate-alert-autoresponder";
import { sendDropWelcome } from "@/lib/shop/drop-autoresponder";

export const runtime = "nodejs";

/**
 * POST /api/email-capture
 *
 * Captures an email lead from any ungated tool/resource.
 * Body: { email, name?, source, data? }
 */
export async function POST(request: Request) {
  const limited = await rateLimitByIp(request, "email-capture", 10, 3600);
  if (limited) return limited;
  try {
    const { email: rawEmail, name, source, data } = await request.json() as {
      email?: string;
      name?: string;
      source?: string;
      data?: Record<string, unknown>;
    };

    const email = typeof rawEmail === "string" ? rawEmail.trim().toLowerCase() : "";
    if (!email || !email.includes("@") || email.length > 254) {
      return NextResponse.json({ error: "Valid email required" }, { status: 400 });
    }

    if (typeof source !== "string" || !source.trim() || source.length > 100) {
      return NextResponse.json({ error: "Source required" }, { status: 400 });
    }

    // Detect new vs duplicate so we only notify once per email
    const existing = await prisma.emailLead.findUnique({ where: { email }, select: { id: true, source: true } });
    const isNew = !existing || existing.source !== source;

    const lead = await prisma.$transaction(async tx => {
      const lead = await tx.emailLead.upsert({
      where: { email },
      create: {
        email,
        name: name ?? null,
        source,
        data: data as Prisma.InputJsonValue ?? Prisma.JsonNull,
        tags: [source],
        optedIn: true,
      },
      update: {
        ...(isNew ? { status: "new", statusNote: null, statusUpdatedAt: new Date() } : {}),
        // Don't overwrite name if already set; update source/data to latest
        ...(name ? { name } : {}),
        source,
        data: data as Prisma.InputJsonValue ?? Prisma.JsonNull,
      },
    });

      // Idempotent outbox keys also cover retries after a lost HTTP response.
      if (isNew) await enqueueLeadNotifications(tx, "email", lead.id, { source, email, name, data });
      return lead;
    });
    after(() => deliverLeadNotifications(lead.id));

    // Estate-alerts joiners expect the address, not a wait. The cron only
    // blasts once per sale, so anyone joining after that blast is covered here.
    // after() so a slow SMTP hop never delays (or fails) the signup response —
    // the lead is already committed above.
    if (source === "estate-alerts") {
      after(() => sendEstateAddressIfRevealed(lead.id, email));
    }

    // Drop-list joiners get the current haul immediately — the form promises an
    // email and this is the one that keeps it. Deliberately NOT gated on isNew:
    // the WELCOME_TAG is the real dedup guard, so anyone who signed up during
    // the period when nothing sent gets healed if they ever resubmit.
    if (source === "shop-drops") {
      after(() => sendDropWelcome(lead.id, email));
    }

    return NextResponse.json({ ok: true, id: lead.id, isNew });
  } catch (error) {
    console.error("email-capture error", error);
    return NextResponse.json({ error: "Failed to capture email" }, { status: 500 });
  }
}
