import { prisma } from "@/lib/prisma";
import { sendSms } from "@/lib/twilio";

export const REQUIRED_DOCUMENTS = [
  "drivers_license",
  "insurance",
  "registration",
] as const;

export type DocumentType = (typeof REQUIRED_DOCUMENTS)[number];

export const DOC_LABELS: Record<DocumentType, string> = {
  drivers_license: "Driver's License",
  insurance: "Insurance",
  registration: "Vehicle Registration",
};

/** Check if a driver has all required docs approved and not expired */
export async function isDriverCompliant(driverId: string): Promise<{
  compliant: boolean;
  missing: string[];
  expired: string[];
  pending: string[];
}> {
  const docs = await prisma.driverDocument.findMany({
    where: { driverId },
  });

  const missing: string[] = [];
  const expired: string[] = [];
  const pending: string[] = [];
  const now = new Date();

  for (const type of REQUIRED_DOCUMENTS) {
    const doc = docs.find((d) => d.type === type);
    if (!doc) {
      missing.push(type);
    } else if (doc.status === "expired" || (doc.expiresAt && doc.expiresAt < now)) {
      expired.push(type);
    } else if (doc.status === "pending") {
      pending.push(type);
    } else if (doc.status === "rejected") {
      missing.push(type);
    }
  }

  return {
    compliant: missing.length === 0 && expired.length === 0 && pending.length === 0,
    missing,
    expired,
    pending,
  };
}

/** Run compliance check across all approved drivers, send warnings, suspend expired */
export async function runComplianceCheck(): Promise<{
  checked: number;
  warnings: number;
  suspended: number;
  expired: number;
}> {
  const now = new Date();
  let warnings = 0;
  let suspended = 0;
  let expiredCount = 0;

  // Find all documents with expiration dates
  const docs = await prisma.driverDocument.findMany({
    where: {
      status: "approved",
      expiresAt: { not: null },
    },
    include: {
      driver: { select: { id: true, name: true, phone: true, status: true } },
    },
  });

  for (const doc of docs) {
    if (!doc.expiresAt) continue;

    const daysUntilExpiry = Math.ceil(
      (doc.expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );
    const label = DOC_LABELS[doc.type as DocumentType] || doc.type;

    // Already expired — mark it
    if (daysUntilExpiry <= 0) {
      await prisma.driverDocument.update({
        where: { id: doc.id },
        data: { status: "expired" },
      });
      expiredCount++;

      // Suspend driver if they were approved
      if (doc.driver.status === "approved") {
        await prisma.deliveryDriver.update({
          where: { id: doc.driver.id },
          data: { status: "suspended", isOnline: false, notes: `Auto-suspended: ${label} expired` },
        });
        suspended++;

        await sendSms(
          doc.driver.phone,
          `⚠️ RED ALERT: Your ${label} has expired. Your account is suspended until you upload a valid document.\n` +
            `Update: tolley.io/drive/driver/documents`
        ).catch(() => {});
      }
      continue;
    }

    // Warning thresholds
    const thresholds = [
      { days: 30, field: "warned30d" as const },
      { days: 14, field: "warned14d" as const },
      { days: 7, field: "warned7d" as const },
      { days: 1, field: "warned1d" as const },
    ];

    for (const { days, field } of thresholds) {
      if (daysUntilExpiry <= days && !doc[field]) {
        await prisma.driverDocument.update({
          where: { id: doc.id },
          data: { [field]: true },
        });

        const urgency = days <= 1 ? "🚨 URGENT" : days <= 7 ? "⚠️ WARNING" : "📋 REMINDER";
        await sendSms(
          doc.driver.phone,
          `${urgency}: Your ${label} expires in ${daysUntilExpiry} day${daysUntilExpiry === 1 ? "" : "s"}.\n` +
            `Upload updated document: tolley.io/drive/driver/documents\n` +
            `Failure to update will result in account suspension.`
        ).catch(() => {});
        warnings++;
        break; // Only send the most urgent warning
      }
    }
  }

  return { checked: docs.length, warnings, suspended, expired: expiredCount };
}
