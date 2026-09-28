import test, { after } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../../lib/prisma";
import { reserveCampaign, drainCampaign } from "../../lib/live/campaign-publish";
import { getStoredToken } from "../../lib/social/token-store";
import { centralDate, centralInstant } from "../../lib/live/campaign";
if (!process.env.DATABASE_URL?.includes("127.0.0.1:55449/tolley_live_growth_test")) throw new Error("Isolated campaign test database required");
test("campaign reservations are atomic, bound, capped, cancellable and pauseable", async () => {
  await prisma.liveCampaignPost.deleteMany(); await prisma.livePublication.deleteMany();
  await prisma.liveSettings.upsert({ where: { id: "treasure-hauls" }, create: { campaignPaused: false, bindings: { facebook: { accountId: "test-haul", label: "Test" } } }, update: { campaignPaused: false, bindings: { facebook: { accountId: "test-haul", label: "Test" } } } });
  const now = new Date();
  const show = await prisma.liveShow.create({ data: { title: "Campaign test", category: "Electronics", startsAt: new Date(now.getTime() + 3600000), whatnotUrl: "https://www.whatnot.com/live/test", status: "confirmed" } });
  const make = (kind: string, data = {}) => prisma.liveCampaignPost.create({ data: { showId: show.id, kind, platform: "facebook", accountId: "test-haul", caption: "Tonight: a show full of finds.", dueAt: new Date(now.getTime() - 1000), expiresAt: new Date(now.getTime() + 3600000), status: "queued", ...data } });
  const first = await make("recap");
  const claims = await Promise.all(Array.from({ length: 8 }, () => reserveCampaign(first.id, now)));
  assert.equal(claims.filter(Boolean).length, 1);
  assert.equal(await reserveCampaign((await make("wrong", { accountId: "other-brand" })).id, now), null);
  assert.equal(await reserveCampaign((await make("story", { manual: true })).id, now), null);
  const second = await make("preview"); assert.ok(await reserveCampaign(second.id, now));
  const third = await make("fact");
  assert.equal(await reserveCampaign(third.id, now), null);
  const yesterday = new Date(centralInstant(centralDate(now), "00:00").getTime() - 1000);
  await prisma.liveCampaignPost.updateMany({ where: { id: { in: [first.id, second.id] } }, data: { updatedAt: yesterday } });
  assert.ok(await reserveCampaign(third.id, now), "yesterday's slots cannot delay today's campaign");
  await prisma.liveSettings.update({ where: { id: "treasure-hauls" }, data: { campaignPaused: true } });
  await prisma.liveCampaignPost.update({ where: { id: first.id }, data: { status: "queued" } });
  assert.equal(await reserveCampaign(first.id, now), null);
  await prisma.liveSettings.update({ where: { id: "treasure-hauls" }, data: { campaignPaused: false } });
  await prisma.liveShow.update({ where: { id: show.id }, data: { status: "canceled" } });
  assert.equal(await reserveCampaign(first.id, now), null);
  assert.equal((await prisma.liveCampaignPost.findUniqueOrThrow({ where: { id: first.id } })).status, "canceled");
  await prisma.liveCampaignPost.deleteMany(); await prisma.liveShow.delete({ where: { id: show.id } });
});
test("lost upstream response stays uncertain and is never retried", async () => {
  const now = new Date();
  await prisma.liveSettings.update({ where: { id: "treasure-hauls" }, data: { campaignPaused: false } });
  await prisma.platformConnection.create({ data: { subscriberId: "social-suite", platform: "facebook_page:test-haul", platformAccountId: "test-haul", accessToken: "test-only", status: "active" } });
  const row = await prisma.liveCampaignPost.create({ data: { kind: "recap", platform: "facebook", accountId: "test-haul", caption: "Past show highlights. Follow Treasure Hauls.", status: "queued", dueAt: new Date(now.getTime() - 1000), expiresAt: new Date(now.getTime() + 60000) } });
  const original = globalThis.fetch; let sends = 0;
  globalThis.fetch = async (_url, options) => { if (options?.method === "POST") { sends++; throw new Error("response lost"); } return Response.json({ id: "test-haul" }); };
  try {
    await drainCampaign(); await drainCampaign();
    assert.equal(sends, 1);
    assert.equal((await prisma.liveCampaignPost.findUniqueOrThrow({ where: { id: row.id } })).status, "uncertain");
  } finally { globalThis.fetch = original; await prisma.liveCampaignPost.deleteMany(); await prisma.platformConnection.deleteMany({ where: { platform: "facebook_page:test-haul" } }); }
});
test("dedicated haul credentials never become the generic account fallback", async () => {
  await prisma.platformConnection.createMany({ data: [
    { subscriberId: "social-suite", platform: "youtube", platformAccountId: "test-generic", accessToken: "generic-test", status: "active" },
    { subscriberId: "treasure-hauls", platform: "youtube", platformAccountId: "test-dedicated", accessToken: "haul-test", status: "active" },
  ] });
  try {
    assert.equal((await getStoredToken("youtube"))?.accountId, "test-generic");
    assert.equal((await getStoredToken("youtube", "test-dedicated"))?.accountId, "test-dedicated");
    assert.equal(await getStoredToken("youtube", "unbound"), null);
  } finally { await prisma.platformConnection.deleteMany({ where: { platformAccountId: { in: ["test-generic", "test-dedicated"] } } }); }
});
after(() => prisma.$disconnect());
