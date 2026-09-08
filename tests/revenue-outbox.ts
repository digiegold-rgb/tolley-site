import assert from "node:assert/strict";
import { prisma } from "../lib/prisma";
import { deliverLeadNotifications, enqueueLeadNotifications } from "../lib/lead-notification-outbox";
if (!process.env.DATABASE_URL?.includes("127.0.0.1:55438/tolley_revenue_test")) throw new Error("Isolated test database required");
async function main() {
  const leadId = crypto.randomUUID();
  await prisma.$transaction(async tx => {
    await enqueueLeadNotifications(tx, "email", leadId, { source: "wd", email: "test@example.invalid" });
    await enqueueLeadNotifications(tx, "email", leadId, { source: "wd", email: "test@example.invalid" });
  });
  assert.equal(await prisma.leadNotification.count({ where: { leadId } }), 2);
  await deliverLeadNotifications(leadId, async () => { throw new Error("Simulated outage"); });
  const failed = await prisma.leadNotification.findMany({ where: { leadId } });
  assert.ok(failed.every(r => r.status === "pending" && r.attempts === 1 && r.lastError));
  await prisma.leadNotification.updateMany({ where: { leadId }, data: { availableAt: new Date(0) } });
  let sends = 0;
  const sender = async () => { sends++; await new Promise(resolve => setTimeout(resolve, 20)); };
  await Promise.all([deliverLeadNotifications(leadId, sender), deliverLeadNotifications(leadId, sender)]);
  assert.equal(sends, 2);
  await deliverLeadNotifications(leadId, sender);
  assert.equal(sends, 2, "successful channels are not redelivered");
  assert.equal(await prisma.leadNotification.count({ where: { leadId, status: "sent" } }), 2);
  console.log("PASS: durable outbox retries, deduplication, parallel leases, successful-channel isolation.");
}
main().catch(e => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
