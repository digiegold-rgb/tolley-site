import { Prisma, type LeadNotification } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sendDiscord, sendEmail, sendActionDiscord, sendActionEmail,
  type LeadNotifyArgs, type LeadActionNotifyArgs } from "@/lib/lead-notify";

export async function enqueueLeadNotifications(
  tx: Prisma.TransactionClient, kind: "email" | "action", leadId: string,
  payload: LeadNotifyArgs | LeadActionNotifyArgs,
) {
  for (const channel of ["email", "discord"]) {
    const source = kind === "email" ? (payload as LeadNotifyArgs).source : (payload as LeadActionNotifyArgs).action;
    const id = `${kind}:${leadId}:${source}:${channel}`;
    await tx.leadNotification.createMany({ skipDuplicates: true, data: {
      id, kind, leadId, channel,
      payload: JSON.parse(JSON.stringify(payload)) as Prisma.InputJsonValue,
    } });
  }
}

/** Per-channel leases prevent parallel cron/after workers from sending together.
 * A crash after provider acceptance can redeliver; this is at-least-once delivery.
 * Never enqueue customer marketing or historical imports here. */
async function sendNotification(row: LeadNotification) {
  if (row.kind === "action") {
    const args = row.payload as unknown as LeadActionNotifyArgs;
    await (row.channel === "email" ? sendActionEmail(args) : sendActionDiscord(args));
  } else {
    const args = row.payload as unknown as LeadNotifyArgs;
    await (row.channel === "email" ? sendEmail(args) : sendDiscord(args));
  }
}

export async function deliverLeadNotifications(leadId?: string, send = sendNotification) {
  const now = new Date();
  await prisma.leadNotification.updateMany({
    where: { status: "sending", lockedAt: { lt: new Date(+now - 120000) } },
    data: { status: "pending", lockedAt: null },
  });
  const rows = await prisma.leadNotification.findMany({
    where: { status: "pending", attempts: { lt: 5 }, availableAt: { lte: now }, ...(leadId ? { leadId } : {}) },
    orderBy: { availableAt: "asc" }, take: 4,
  });
  let sent = 0;
  for (const row of rows) {
    const claim = await prisma.leadNotification.updateMany({
      where: { id: row.id, status: "pending", attempts: row.attempts },
      data: { status: "sending", lockedAt: now, attempts: { increment: 1 } },
    });
    if (!claim.count) continue;
    try {
      await send(row);
      await prisma.leadNotification.update({ where: { id: row.id }, data: {
        status: "sent", sentAt: new Date(), lastError: null, lockedAt: null,
      } });
      sent++;
    } catch {
      // Provider errors can contain email addresses, request URLs and secrets.
      await prisma.leadNotification.update({ where: { id: row.id }, data: {
        status: row.attempts + 1 >= 5 ? "failed" : "pending", lockedAt: null,
        lastError: `${row.channel} delivery failed; check provider configuration and logs`,
        availableAt: new Date(Date.now() + Math.min(3600000, 60000 * 2 ** row.attempts)),
      } });
    }
  }
  // An interrupted final attempt must not remain pending forever.
  await prisma.leadNotification.updateMany({ where: { status: "pending", attempts: { gte: 5 } }, data: { status: "failed" } });
  return { checked: rows.length, sent };
}
