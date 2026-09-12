import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "../lib/prisma";
import { createWeekdayDrop } from "../lib/leads/weekday-drop";
import { readSellerDraft, weekdayDropClock } from "../lib/leads/weekday-plan";
import { applyDailyAction } from "../lib/leads/daily-actions";
import { loadDailyDesk } from "../lib/leads/daily-desk";

if (process.env.DATABASE_URL !== "postgresql://postgres@127.0.0.1:55438/tolley_weekday_test") throw new Error("Dedicated weekday test database required");
const key = randomUUID(), subscriberId = `weekday-test-${key}`;
const now = new Date("2026-09-14T13:00:00Z");
const listings: string[] = [];
const optoutPhone = "+18165559989";

async function fixture(name: string, score: number, options: { state?: string; city?: string; status?: string; completedAt?: Date; owner?: string; phone?: string; customerStatus?: string } = {}) {
  const listing = await prisma.listing.create({ data: { mlsId: `${key}-${name}`, address: `${name} Test Street`, city: options.city ?? "Independence", state: options.state ?? "MO", status: options.status ?? "Expired", photoUrls: [] } });
  listings.push(listing.id);
  const lead = await prisma.lead.create({ data: { listingId: listing.id, ownerSubscriberId: options.owner ?? null, ownerPhone: options.phone } });
  if (options.customerStatus) await prisma.customerLeadState.create({ data: { subscriberId, leadId: lead.id, status: options.customerStatus } });
  const job = await prisma.dossierJob.create({ data: { listingId: listing.id, status: "complete", completedAt: options.completedAt ?? now, stepsCompleted: [], stepsFailed: [], result: { create: { motivationScore: score, motivationFlags: ["Verify property timing"], neighborhoodPhotos: [] } } } });
  return { listing, lead, job };
}
async function main() {
  for (const date of ["2026-09-14T13:00:00Z", "2026-11-02T14:00:00Z", "2026-03-09T13:00:00Z"]) assert(weekdayDropClock(new Date(date)).eligible, date);
  for (const date of ["2026-09-12T13:00:00Z", "2026-09-14T14:00:00Z", "2026-11-02T13:00:00Z"]) assert(!weekdayDropClock(new Date(date)).eligible, date);
  assert.deepEqual(await createWeekdayDrop(subscriberId, new Date("2026-09-12T13:00:00Z")), { skipped: "outside_weekday_8am_chicago" });
  await prisma.user.create({ data: { id: subscriberId, email: `${key}@example.invalid`, leadSubscription: { create: { id: subscriberId, farmZips: [], farmCities: [], specialties: [] } } } });
  await fixture("foreign", 100, { owner: "another-workspace" });
  await fixture("sold", 100, { status: "SOLD" });
  await fixture("independence-kansas", 100, { state: "KS" });
  await fixture("far", 100, { city: "St. Louis" });
  await fixture("stale", 100, { completedAt: new Date("2026-08-01T13:00:00Z") });
  await fixture("contacted", 100, { customerStatus: "contacted" });
  await fixture("optout", 100, { phone: "8165559989" });
  await prisma.smsOptOut.create({ data: { phone: optoutPhone } });
  const busy = await fixture("already-following-up", 100);
  await prisma.crmTask.create({ data: { subscriberId, leadId: busy.lead.id, title: "Existing promise", dueDate: new Date("2026-09-16T13:00:00Z") } });
  const candidates = [];
  for (let i = 0; i < 7; i++) candidates.push(await fixture(`candidate-${i}`, 95 - i));
  await fixture("below-threshold", 49);
  const settled = await Promise.allSettled([createWeekdayDrop(subscriberId, now), createWeekdayDrop(subscriberId, now)]);
  const results = settled.map(r => { if (r.status === "rejected") throw r.reason; return r.value; });
  assert.equal(results.filter(r => "alreadySaved" in r).length, 1, "concurrent cron calls produce one batch");
  let tasks = await prisma.crmTask.findMany({ where: { subscriberId, type: "seller_draft" }, orderBy: { id: "asc" } });
  assert.equal(tasks.length, 5);
  assert.deepEqual(tasks.map(t => readSellerDraft(t.description)?.score), [95, 94, 93, 92, 91]);
  assert(tasks.every(t => t.status === "pending"));
  const desk = await loadDailyDesk(subscriberId, true, now);
  assert.equal(desk.sellerDrafts?.length, 5);
  assert.equal(desk.tasks.length, 0, "drafts do not crowd the existing three follow-ups");
  assert.equal(desk.weekdayDrop?.shortfall, 0);
  assert.equal((await loadDailyDesk(subscriberId, false, now)).sellerDrafts?.length, 0, "owner section stays private");
  const task = tasks[0], original = readSellerDraft(task.description)!;
  const edit = { action: "save-draft" as const, taskId: task.id, previousBody: original.body, body: "Personal draft reviewed locally." };
  await assert.rejects(applyDailyAction(subscriberId, false, edit), e => (e as { status: number }).status === 403);
  await assert.rejects(applyDailyAction("other-subscriber", true, edit), e => (e as { status: number }).status === 404);
  await applyDailyAction(subscriberId, true, edit);
  await assert.rejects(applyDailyAction(subscriberId, true, { ...edit, body: "Stale overwrite" }), e => (e as { status: number }).status === 409);
  await applyDailyAction(subscriberId, true, { action: "outcome", taskId: task.id, requestId: randomUUID(), outcome: "snooze", note: "Verify contact", nextAt: "2030-01-01T16:00:00Z" }, now);
  assert.equal(readSellerDraft((await prisma.crmTask.findUniqueOrThrow({ where: { id: task.id } })).description)?.body, edit.body, "snooze preserves draft");
  await applyDailyAction(subscriberId, true, { action: "outcome", taskId: task.id, requestId: randomUUID(), outcome: "attempted", note: "Sent personally", nextAt: "2030-01-02T16:00:00Z" }, now);
  assert.equal(await prisma.crmTask.count({ where: { subscriberId, leadId: task.leadId, type: "follow_up", status: "pending", description: "Sent personally" } }), 1);
  const next = await createWeekdayDrop(subscriberId, new Date("2026-09-15T13:00:00Z"));
  assert("report" in next && next.report && (next.report as { count: number }).count === 2, "next day takes remaining candidates and reports shortage");
  tasks = await prisma.crmTask.findMany({ where: { subscriberId, type: "seller_draft" } });
  assert.equal(new Set(tasks.map(t => t.leadId)).size, 7, "prior-day targets never repeat");
  assert.equal(await prisma.growthTouch.count(), 0, "no outbound growth queue entries");
  assert.equal(await prisma.smsMessage.count(), 0, "no SMS created");
  console.log("PASS: weekday/DST gates, five ranked targets, freshness/geography/status/opt-out filters, owner isolation, concurrent idempotency, shortfall, draft edits, touch follow-up and zero outbound writes.");
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  await prisma.crmActivity.deleteMany({ where: { subscriberId } });
  await prisma.crmTask.deleteMany({ where: { subscriberId } });
  await prisma.lead.deleteMany({ where: { listingId: { in: listings } } });
  await prisma.listing.deleteMany({ where: { id: { in: listings } } });
  await prisma.user.deleteMany({ where: { id: subscriberId } });
  await prisma.smsOptOut.deleteMany({ where: { phone: optoutPhone } });
  await prisma.$disconnect();
});
