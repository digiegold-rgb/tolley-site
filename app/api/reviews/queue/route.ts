import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateShopAdmin } from "@/lib/shop-auth";
import { getGbp } from "@/lib/reviews/gbps";
import { newShortCode } from "@/lib/reviews/short-code";

interface QueueItem {
  phone?: string;
  email?: string;
  name?: string;
}

function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/[^\d+]/g, "");
  if (!digits) return null;
  // US numbers: prepend +1 if 10 digits
  if (/^\d{10}$/.test(digits)) return `+1${digits}`;
  if (/^1\d{10}$/.test(digits)) return `+${digits}`;
  if (/^\+\d{10,15}$/.test(digits)) return digits;
  return null;
}

/**
 * POST /api/reviews/queue
 *
 * Body: { gbpKey: string, channel: "sms" | "email", recipients: QueueItem[] }
 *
 * Creates one ReviewRequest per recipient with status="queued". A separate
 * /api/reviews/send call processes the queue (or the operator can click
 * "Send all" in the dashboard).
 */
export async function POST(req: NextRequest) {
  if (!(await validateShopAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const gbpKey = typeof body.gbpKey === "string" ? body.gbpKey : "";
  const channel = body.channel === "email" ? "email" : "sms";
  const recipients: QueueItem[] = Array.isArray(body.recipients)
    ? body.recipients
    : [];

  const gbp = getGbp(gbpKey);
  if (!gbp || !gbp.reviewUrl) {
    return NextResponse.json(
      { error: `GBP ${gbpKey} not configured (missing review URL env var)` },
      { status: 400 }
    );
  }
  if (recipients.length === 0) {
    return NextResponse.json({ error: "No recipients" }, { status: 400 });
  }

  let queued = 0;
  const errors: string[] = [];

  for (const r of recipients) {
    const phone = r.phone ? normalizePhone(r.phone) : null;
    const email = r.email?.trim() || null;
    if (channel === "sms" && !phone) {
      errors.push(`Skipped ${r.phone ?? "?"} — invalid phone`);
      continue;
    }
    if (channel === "email" && !email) {
      errors.push(`Skipped ${r.email ?? "?"} — missing email`);
      continue;
    }

    try {
      await prisma.reviewRequest.create({
        data: {
          phone,
          email,
          recipientName: r.name?.trim() || null,
          sourceType: "manual_paste",
          gbpKey,
          shortCode: newShortCode(),
          status: "queued",
          channel,
        },
      });
      queued += 1;
    } catch (err) {
      errors.push(
        `Failed to queue ${phone ?? email ?? "?"}: ${err instanceof Error ? err.message : "error"}`
      );
    }
  }

  return NextResponse.json({ queued, errors });
}
