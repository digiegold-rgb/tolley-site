/**
 * POST /api/unclaimed/claim/[id]/outreach — Send SMS to fund owner
 *
 * GATED: Requires UNCLAIMED_OUTREACH_ENABLED=true env var.
 * This is disabled by default until MO State Treasurer registration is confirmed.
 */

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const OUTREACH_ENABLED = process.env.UNCLAIMED_OUTREACH_ENABLED === "true";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "LOGIN_REQUIRED" }, { status: 401 });
  }

  if (!OUTREACH_ENABLED) {
    return NextResponse.json(
      {
        error: "OUTREACH_DISABLED",
        message:
          "Unclaimed funds outreach is disabled. Requires MO State Treasurer registration. Set UNCLAIMED_OUTREACH_ENABLED=true after registration is confirmed.",
      },
      { status: 403 }
    );
  }

  const { id } = await params;
  const body = await req.json();
  const { phone, message } = body;

  if (!phone || !message) {
    return NextResponse.json(
      { error: "phone and message are required" },
      { status: 400 }
    );
  }

  const claim = await prisma.unclaimedFundClaim.findUnique({
    where: { id },
    include: { fund: { include: { scan: true } } },
  });

  if (!claim) {
    return NextResponse.json({ error: "Claim not found" }, { status: 404 });
  }

  if (claim.fund.scan.userId !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Send via existing SMS infrastructure
  const SYNC_SECRET = process.env.SYNC_SECRET || "";
  const baseUrl = process.env.NEXTAUTH_URL || `https://${process.env.VERCEL_URL}`;

  try {
    const smsRes = await fetch(`${baseUrl}/api/sms/send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-sync-secret": SYNC_SECRET,
      },
      body: JSON.stringify({
        to: phone,
        message,
      }),
    });

    if (!smsRes.ok) {
      const errData = await smsRes.json().catch(() => ({}));
      return NextResponse.json(
        { error: "SMS send failed", details: errData },
        { status: 500 }
      );
    }

    // Update claim
    await prisma.unclaimedFundClaim.update({
      where: { id },
      data: {
        ownerPhone: phone,
        contactAttempts: { increment: 1 },
        lastContactAt: new Date(),
        status: claim.status === "identified" ? "contacted" : claim.status,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: `Outreach failed: ${String(e)}` },
      { status: 500 }
    );
  }
}
