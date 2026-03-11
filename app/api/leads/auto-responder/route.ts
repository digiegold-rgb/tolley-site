import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getLeadsTierLimits } from "@/lib/leads-subscription";

export const runtime = "nodejs";

/**
 * GET /api/leads/auto-responder
 * Returns the subscriber's auto-responder config.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sub = await prisma.leadSubscriber.findUnique({
    where: { userId: session.user.id },
    select: { id: true, tier: true },
  });
  if (!sub) {
    return NextResponse.json({ error: "No subscription" }, { status: 403 });
  }

  const config = await prisma.autoResponder.findFirst({
    where: { subscriberId: sub.id },
  });

  const limits = getLeadsTierLimits(sub.tier as "starter" | "pro" | "team");

  return NextResponse.json({
    config,
    limits: {
      autoResponseLimit: limits.autoResponseLimit,
      agentNotify: limits.agentNotify,
    },
  });
}

/**
 * POST /api/leads/auto-responder
 * Create or update auto-responder config.
 */
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sub = await prisma.leadSubscriber.findUnique({
    where: { userId: session.user.id },
    select: { id: true, tier: true },
  });
  if (!sub) {
    return NextResponse.json({ error: "No subscription" }, { status: 403 });
  }

  const body = await request.json();
  const limits = getLeadsTierLimits(sub.tier as "starter" | "pro" | "team");

  const data = {
    subscriberId: sub.id,
    name: body.name || "Default",
    isActive: body.isActive ?? true,
    triggerSource: body.triggerSource || ["mls_expired", "mls_pricedrop", "mls_dom"],
    minScore: Math.max(0, Math.min(100, body.minScore ?? 30)),
    promptId: body.promptId || "speed_to_lead_seller",
    delaySeconds: Math.max(10, Math.min(300, body.delaySeconds ?? 30)),
    maxPerDay: Math.min(body.maxPerDay ?? 20, limits.autoResponseLimit),
    notifyPhone: limits.agentNotify ? (body.notifyPhone || null) : null,
    notifyEmail: limits.agentNotify ? (body.notifyEmail || null) : null,
    notifyMinScore: body.notifyMinScore ?? 60,
    activeStartHour: Math.max(0, Math.min(23, body.activeStartHour ?? 9)),
    activeEndHour: Math.max(0, Math.min(23, body.activeEndHour ?? 20)),
    timezone: body.timezone || "America/Chicago",
  };

  // Upsert — one auto-responder per subscriber for now
  const existing = await prisma.autoResponder.findFirst({
    where: { subscriberId: sub.id },
  });

  let config;
  if (existing) {
    config = await prisma.autoResponder.update({
      where: { id: existing.id },
      data,
    });
  } else {
    config = await prisma.autoResponder.create({ data });
  }

  return NextResponse.json({ ok: true, config });
}
