import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { sendSms } from "@/lib/twilio";
import { sendWdEmail } from "@/lib/wd/email";
import { SmsOptedOutError } from "@/lib/sms-optout";
import { notifyRenter } from "./store";
import { answerMessage } from "./assistant";
import { settleBooking } from "./billing";
export async function runLaundryWorker() {
  const expired = await prisma.laundryLead.findMany({
    where: { status: "requested", expiresAt: { lt: new Date() } },
    take: 50,
  });
  for (const lead of expired)
    await prisma.$transaction(async (tx) => {
      const changed = await tx.laundryLead.updateMany({
        where: {
          id: lead.id,
          status: "requested",
          expiresAt: { lt: new Date() },
        },
        data: { status: "expired", expiresAt: null },
      });
      if (changed.count) {
        await tx.laundryEvent.create({
          data: {
            leadId: lead.id,
            actor: "system",
            action: "expired",
            detail:
              "No acceptance within 24 hours. Renter can select another operator.",
          },
        });
        await notifyRenter(
          tx,
          lead,
          "expired",
          "Your operator did not accept in time. You can choose another operator through your request link.",
        );
      }
    });
  if (process.env.LAUNDRY_BILLING_ENABLED === "true") {
    const bookings = await prisma.laundryBooking.findMany({
      where: { status: { in: ["pending", "processing", "refund_pending"] } },
      take: 20,
      orderBy: { createdAt: "asc" },
    });
    for (const b of bookings) {
      try {
        await settleBooking(b.id);
      } catch {
        /* durable pending state remains visible to admin */
      }
    }
  }
  if (process.env.LAUNDRY_NOTIFICATIONS_ENABLED !== "true")
    return { expired: expired.length, notifications: "disabled" };
  const inbound = await prisma.laundryMessage.findMany({
    where: { reply: null, leadId: { not: null } },
    take: 10,
    orderBy: { createdAt: "asc" },
  });
  for (const m of inbound) await answerMessage(m.id);
  let sent = 0;
  for (let n = 0; n < 20; n++) {
    const token = randomUUID();
    const rows = await prisma.$queryRaw<
      Array<{
        id: string;
        channel: string;
        recipient: string;
        body: string;
        attempts: number;
      }>
    >`UPDATE "LaundryNotification" SET "status"='sending', "leaseToken"=${token}, "leaseUntil"=NOW()+INTERVAL '120 seconds', "attempts"="attempts"+1 WHERE "id"=(SELECT "id" FROM "LaundryNotification" WHERE (("status"='pending' AND "availableAt"<=NOW()) OR ("status"='sending' AND "leaseUntil"<NOW())) AND "attempts"<5 ORDER BY "createdAt" LIMIT 1 FOR UPDATE SKIP LOCKED) RETURNING *`;
    const job = rows[0];
    if (!job) break;
    try {
      let providerId: string | null = null;
      if (job.channel === "sms") {
        if (!process.env.LAUNDRY_MESSAGING_SERVICE_SID)
          throw new Error("Sender unavailable");
        providerId = await sendSms(job.recipient, job.body, {
          messagingServiceSid: process.env.LAUNDRY_MESSAGING_SERVICE_SID,
        });
      } else {
        if (!process.env.EMAIL_SERVER_HOST)
          throw new Error("Email unavailable");
        const safe = job.body.replace(
          /[&<>"']/g,
          (c) =>
            ({
              "&": "&amp;",
              "<": "&lt;",
              ">": "&gt;",
              '"': "&quot;",
              "'": "&#39;",
            })[c]!,
        );
        await sendWdEmail({
          to: job.recipient,
          subject: "Your Laundry Rental Network update",
          text: job.body,
          html: `<pre style="white-space:pre-wrap;font-family:Arial,sans-serif">${safe}</pre>`,
          from: process.env.LAUNDRY_EMAIL_FROM || process.env.EMAIL_FROM,
        });
      }
      await prisma.laundryNotification.updateMany({
        where: { id: job.id, leaseToken: token },
        data: {
          status: "sent",
          providerId,
          leaseToken: null,
          leaseUntil: null,
          lastError: null,
        },
      });
      sent++;
    } catch (e) {
      await prisma.laundryNotification.updateMany({
        where: { id: job.id, leaseToken: token },
        data: {
          status:
            e instanceof SmsOptedOutError
              ? "suppressed"
              : job.attempts >= 5
                ? "failed"
                : "pending",
          leaseToken: null,
          leaseUntil: null,
          lastError:
            e instanceof SmsOptedOutError
              ? "Recipient opted out"
              : "Delivery failed; provider details omitted",
          availableAt: new Date(Date.now() + 30000 * 2 ** job.attempts),
        },
      });
    }
  }
  await prisma.laundryNotification.updateMany({
    where: {
      status: "sending",
      attempts: { gte: 5 },
      leaseUntil: { lt: new Date() },
    },
    data: {
      status: "failed",
      leaseToken: null,
      leaseUntil: null,
      lastError: "Delivery result unknown; inspect before retrying.",
    },
  });
  return { expired: expired.length, sent };
}
