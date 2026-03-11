import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/**
 * POST /api/leads/auto-responder/trigger
 *
 * Internal endpoint called by sync/import hooks after new leads are created.
 * Finds active auto-responders, checks eligibility, and fires off SMS via /api/sms/send.
 *
 * Body: { leads: [{ id, score, source, ownerPhone, listingId }] }
 * Auth: x-sync-secret
 */
export async function POST(request: NextRequest) {
  const syncSecret = process.env.SYNC_SECRET;
  const authHeader = request.headers.get("x-sync-secret");
  if (!syncSecret || authHeader !== syncSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const newLeads: Array<{
    id: string;
    score: number;
    source: string;
    ownerPhone?: string;
    listingId?: string;
  }> = body.leads || [];

  if (newLeads.length === 0) {
    return NextResponse.json({ ok: true, triggered: 0, skipped: "no leads" });
  }

  // Get all active auto-responders
  const responders = await prisma.autoResponder.findMany({
    where: { isActive: true },
  });

  if (responders.length === 0) {
    return NextResponse.json({ ok: true, triggered: 0, skipped: "no active responders" });
  }

  // Get subscriber info for each responder
  const subscriberIds = [...new Set(responders.map((r) => r.subscriberId))];
  const subscribers = await prisma.leadSubscriber.findMany({
    where: { id: { in: subscriberIds }, status: "active" },
    select: { id: true, smsUsed: true, smsLimit: true, tier: true },
  });
  const subMap = new Map(subscribers.map((s) => [s.id, s]));

  const now = new Date();
  let triggered = 0;
  let skipped = 0;
  const notifications: Array<{ phone?: string; email?: string; lead: typeof newLeads[0] }> = [];

  for (const responder of responders) {
    const sub = subMap.get(responder.subscriberId);
    if (!sub) continue;

    // Check daily limit
    if (responder.sentToday >= responder.maxPerDay) {
      skipped++;
      continue;
    }

    // Check SMS limit
    if (sub.smsUsed >= sub.smsLimit) {
      skipped++;
      continue;
    }

    // Check active hours
    const tzHour = getHourInTimezone(now, responder.timezone);
    if (tzHour < responder.activeStartHour || tzHour >= responder.activeEndHour) {
      skipped++;
      continue;
    }

    // Filter eligible leads
    for (const lead of newLeads) {
      if (lead.score < responder.minScore) continue;
      if (!lead.ownerPhone) continue;

      // Check trigger source match
      if (responder.triggerSource.length > 0 && lead.source) {
        if (!responder.triggerSource.includes(lead.source)) continue;
      }

      // Re-check limits (they deplete as we go)
      if (responder.sentToday + triggered >= responder.maxPerDay) break;

      // Fire SMS via internal endpoint
      const baseUrl = process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : process.env.NEXTAUTH_URL || "http://localhost:3000";

      try {
        const smsRes = await fetch(`${baseUrl}/api/sms/send`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-sync-secret": syncSecret,
          },
          body: JSON.stringify({
            to: lead.ownerPhone,
            leadId: lead.id,
            promptId: responder.promptId,
            subscriberId: responder.subscriberId,
            context: "Send a speed-to-lead first-contact message. This is the FIRST time reaching out. Be warm, reference the property details, and ask one engaging question.",
          }),
        });

        if (smsRes.ok) {
          triggered++;

          // Mark lead as auto-responded
          await prisma.lead.update({
            where: { id: lead.id },
            data: {
              status: "contacted",
              contactedAt: new Date(),
              notes: (lead.source ? `Auto-responded via ${lead.source}` : "Auto-responded"),
            },
          });

          // Queue agent notification for high-score leads
          if (lead.score >= responder.notifyMinScore) {
            if (responder.notifyPhone || responder.notifyEmail) {
              notifications.push({
                phone: responder.notifyPhone ?? undefined,
                email: responder.notifyEmail ?? undefined,
                lead,
              });
            }
          }
        }
      } catch (err) {
        console.error("[auto-responder/trigger] SMS send error:", err);
      }
    }

    // Update sentToday counter
    if (triggered > 0) {
      await prisma.autoResponder.update({
        where: { id: responder.id },
        data: { sentToday: { increment: triggered } },
      });
    }
  }

  // Send agent notifications
  for (const notif of notifications) {
    if (notif.phone) {
      try {
        const baseUrl = process.env.VERCEL_URL
          ? `https://${process.env.VERCEL_URL}`
          : process.env.NEXTAUTH_URL || "http://localhost:3000";

        await fetch(`${baseUrl}/api/sms/send`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-sync-secret": syncSecret,
          },
          body: JSON.stringify({
            to: notif.phone,
            message: `🔥 High-score lead alert! Score: ${notif.lead.score}. Auto-response sent. Check your dashboard: ${baseUrl}/leads/dashboard`,
          }),
        });
      } catch (err) {
        console.error("[auto-responder/trigger] Agent notification error:", err);
      }
    }
  }

  return NextResponse.json({
    ok: true,
    triggered,
    skipped,
    notifications: notifications.length,
  });
}

function getHourInTimezone(date: Date, timezone: string): number {
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      hour12: false,
      timeZone: timezone,
    });
    return parseInt(formatter.format(date), 10);
  } catch {
    // Fallback to UTC
    return date.getUTCHours();
  }
}
