import { prisma } from "@/lib/prisma";

/**
 * Increment a field on today's ActivityLog for a subscriber.
 * Creates the row if it doesn't exist yet.
 */
export async function incrementActivity(
  subscriberId: string,
  field: "contactsMade" | "followUpsSent" | "newLeads" | "dossiersRun" | "smsSent" | "smsReplies" | "leadsContacted" | "leadsConverted",
  amount = 1
) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  try {
    await prisma.activityLog.upsert({
      where: {
        subscriberId_activityDate: {
          subscriberId,
          activityDate: today,
        },
      },
      create: {
        subscriberId,
        activityDate: today,
        [field]: amount,
      },
      update: {
        [field]: { increment: amount },
      },
    });
  } catch {
    // Non-critical — don't break the main flow
  }
}
