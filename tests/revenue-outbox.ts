import assert from "node:assert/strict";
import { prisma } from "../lib/prisma";
import { deliverLeadNotifications, enqueueLeadNotifications, enqueueCleanoutNotification } from "../lib/lead-notification-outbox";
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
  const cleanoutId = crypto.randomUUID();
  const contact = { name: "Ada_[Homeowner]", phone: "202-555-0100", address: "100 *Example* St" };
  await prisma.$transaction(async tx => {
    await enqueueCleanoutNotification(tx, cleanoutId, contact);
    await enqueueCleanoutNotification(tx, cleanoutId, contact);
  });
  assert.equal(await prisma.leadNotification.count({ where: { leadId: cleanoutId } }), 1);
  const rolledBack = crypto.randomUUID();
  await assert.rejects(prisma.$transaction(async tx => {
    await enqueueCleanoutNotification(tx, rolledBack, contact);
    throw new Error("Rollback");
  }), /Rollback/);
  assert.equal(await prisma.leadNotification.count({ where: { leadId: rolledBack } }), 0);
  const originalFetch = globalThis.fetch;
  const originalToken = process.env.TELEGRAM_BOT_TOKEN;
  const originalChat = process.env.TELEGRAM_CHAT_ID;
  process.env.TELEGRAM_BOT_TOKEN = "test-no-network";
  process.env.TELEGRAM_CHAT_ID = "test-owner";
  let requests = 0;
  let unavailable = true;
  globalThis.fetch = async (url, init) => {
    assert.equal(url, "https://api.telegram.org/bottest-no-network/sendMessage");
    requests++;
    const payload = JSON.parse(init!.body as string);
    assert.equal(payload.parse_mode, undefined, "customer punctuation is sent as plain text");
    assert.ok(payload.text.includes(contact.name));
    assert.ok(payload.text.includes(contact.address));
    return new Response(unavailable ? "Simulated outage" : '{"ok":true}', { status: unavailable ? 503 : 200 });
  };
  try {
    await deliverLeadNotifications(cleanoutId);
    const retry = await prisma.leadNotification.findFirstOrThrow({ where: { leadId: cleanoutId } });
    assert.equal(retry.status, "pending");
    assert.equal(retry.attempts, 1);
    assert.equal(retry.lastError, "telegram delivery failed; check provider configuration and logs");
    unavailable = false;
    await prisma.leadNotification.update({ where: { id: retry.id }, data: { availableAt: new Date(0) } });
    await Promise.all([deliverLeadNotifications(cleanoutId), deliverLeadNotifications(cleanoutId)]);
    await deliverLeadNotifications(cleanoutId);
    assert.equal(requests, 2, "one failed request and one successful retry; no duplicate delivery");
    assert.equal(await prisma.leadNotification.count({ where: { leadId: cleanoutId, status: "sent" } }), 1);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalToken === undefined) delete process.env.TELEGRAM_BOT_TOKEN;
    else process.env.TELEGRAM_BOT_TOKEN = originalToken;
    if (originalChat === undefined) delete process.env.TELEGRAM_CHAT_ID;
    else process.env.TELEGRAM_CHAT_ID = originalChat;
    await prisma.leadNotification.deleteMany({ where: { leadId: { in: [leadId, cleanoutId] } } });
  }
  console.log("PASS: durable outbox retries, deduplication, parallel leases, successful-channel isolation.");
}
main().catch(e => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
