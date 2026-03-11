import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const maxDuration = 120;

/**
 * POST /api/cron/sequence-process
 *
 * Runs every 15 minutes. Processes due enrollment steps:
 * 1. Find enrollments where nextSendAt <= now AND status = "active"
 * 2. Send SMS for current step
 * 3. Advance to next step or mark completed
 *
 * Auth: x-sync-secret
 */
export async function POST(request: NextRequest) {
  const syncSecret = process.env.SYNC_SECRET;
  const authHeader =
    request.headers.get("x-sync-secret") ||
    request.headers.get("authorization")?.replace("Bearer ", "");
  if (!syncSecret || authHeader !== syncSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  let sent = 0;
  let completed = 0;
  let skipped = 0;
  let errors = 0;

  // Find due enrollments (batch of 50 at a time)
  const dueEnrollments = await prisma.smsEnrollment.findMany({
    where: {
      status: "active",
      nextSendAt: { lte: now },
    },
    include: {
      sequence: {
        include: {
          steps: { orderBy: { stepNumber: "asc" } },
        },
      },
    },
    take: 50,
  });

  if (dueEnrollments.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, completed: 0, message: "No due enrollments" });
  }

  // Check subscriber SMS limits
  const subscriberIds = [...new Set(dueEnrollments.map((e) => e.sequence.subscriberId))];
  const subscribers = await prisma.leadSubscriber.findMany({
    where: { id: { in: subscriberIds }, status: "active" },
    select: { id: true, smsUsed: true, smsLimit: true },
  });
  const subMap = new Map(subscribers.map((s) => [s.id, s]));

  const baseUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : process.env.NEXTAUTH_URL || "http://localhost:3000";

  for (const enrollment of dueEnrollments) {
    const { sequence } = enrollment;
    const sub = subMap.get(sequence.subscriberId);

    // Skip if subscriber hit SMS limit
    if (!sub || sub.smsUsed >= sub.smsLimit) {
      skipped++;
      continue;
    }

    // Skip if sequence was deactivated
    if (!sequence.isActive) {
      skipped++;
      continue;
    }

    // Find current step
    const currentStep = sequence.steps.find((s) => s.stepNumber === enrollment.currentStep + 1);
    if (!currentStep) {
      // No more steps — mark completed
      await prisma.smsEnrollment.update({
        where: { id: enrollment.id },
        data: { status: "completed", completedAt: new Date() },
      });
      completed++;
      continue;
    }

    // Check active hours (use hardcoded 9-20 CT as default)
    const tzHour = getHourInTimezone(now, "America/Chicago");
    if (tzHour < 9 || tzHour >= 20) {
      // Reschedule for 9 AM today or tomorrow
      const reschedule = new Date(now);
      if (tzHour >= 20) {
        reschedule.setDate(reschedule.getDate() + 1);
      }
      reschedule.setHours(9 + 6, 0, 0, 0); // 9 AM CT = 15:00 UTC (approx)
      await prisma.smsEnrollment.update({
        where: { id: enrollment.id },
        data: { nextSendAt: reschedule },
      });
      skipped++;
      continue;
    }

    // Build message
    try {
      const smsPayload: Record<string, unknown> = {
        to: enrollment.phoneNumber,
        subscriberId: sequence.subscriberId,
      };

      if (currentStep.isAiGenerated) {
        // AI-generated message
        smsPayload.promptId = currentStep.promptId || "real_estate_leads";
        smsPayload.leadId = enrollment.leadId || undefined;
        smsPayload.context = `This is follow-up #${currentStep.stepNumber} in a drip sequence called "${sequence.name}". ${
          currentStep.stepNumber === 1
            ? "This is the first message — introduce yourself warmly."
            : `Previous messages have been sent. This is a gentle follow-up. Don't repeat the same opening.`
        } Keep it natural and brief.`;
      } else {
        // Template message
        smsPayload.message = currentStep.templateBody;
      }

      const smsRes = await fetch(`${baseUrl}/api/sms/send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-sync-secret": syncSecret,
        },
        body: JSON.stringify(smsPayload),
      });

      if (smsRes.ok) {
        const smsData = await smsRes.json();
        sent++;

        // Advance to next step
        const nextStep = sequence.steps.find((s) => s.stepNumber === currentStep.stepNumber + 1);
        if (nextStep) {
          const nextSendAt = new Date();
          nextSendAt.setDate(nextSendAt.getDate() + nextStep.delayDays);
          nextSendAt.setHours(nextSendAt.getHours() + nextStep.delayHours);

          await prisma.smsEnrollment.update({
            where: { id: enrollment.id },
            data: {
              currentStep: currentStep.stepNumber,
              nextSendAt,
              conversationId: smsData.conversationId || enrollment.conversationId,
            },
          });
        } else {
          // Last step — mark completed
          await prisma.smsEnrollment.update({
            where: { id: enrollment.id },
            data: {
              currentStep: currentStep.stepNumber,
              status: "completed",
              completedAt: new Date(),
              conversationId: smsData.conversationId || enrollment.conversationId,
            },
          });
          completed++;
        }
      } else {
        errors++;
        console.error("[sequence-process] SMS send failed for enrollment", enrollment.id);
      }
    } catch (err) {
      errors++;
      console.error("[sequence-process] Error:", err);
    }
  }

  return NextResponse.json({ ok: true, processed: dueEnrollments.length, sent, completed, skipped, errors });
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
    return date.getUTCHours();
  }
}
