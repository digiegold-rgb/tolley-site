import test from "node:test";
import assert from "node:assert/strict";
import { centralInstant, isLive, canPromote, campaignDecision, campaignPack, assertAutomatedCopy } from "../../lib/live/campaign";
import { parseSalesCsv, saleAmount } from "../../lib/live/sales-import";
import { campaignAwareJobs } from "../../lib/post-schedule";
test("intentional replacement and unbound accounts do not trigger missing-post alarms", () => {
  const active = campaignAwareJobs(true, { facebook: { accountId: "haul" } }, true);
  assert.equal(active.some(j => j.job === "growth-shorts"), false);
  assert.deepEqual(active.find(j => j.job === "hauls-campaign")!.channels.map(c => c.channel), ["fb"]);
  assert.equal(campaignAwareJobs(true, {}, false).some(j => j.job === "hauls-campaign"), false);
  assert.equal(campaignAwareJobs(false, {}, false).some(j => j.job === "growth-shorts"), true);
});
test("Central shows stay at 8:31 through daylight saving changes", () => {
  assert.equal(centralInstant("2026-09-27").toISOString(), "2026-09-28T01:31:00.000Z");
  assert.equal(centralInstant("2026-11-01").toISOString(), "2026-11-02T02:31:00.000Z");
  assert.equal(centralInstant("2027-03-14").toISOString(), "2027-03-15T01:31:00.000Z");
  assert.throws(() => centralInstant("2027-03-14", "02:31"));
  assert.throws(() => centralInstant("2026-02-30"));
});
test("schedule confirmation and elapsed time cannot assert live", () => {
  const now = centralInstant("2026-09-27");
  const show = { status: "confirmed", startsAt: now, endedAt: null, confirmedUntil: new Date(now.getTime() + 3600000) };
  assert.equal(isLive(show, now), false);
  assert.equal(canPromote({ ...show, startsAt: new Date(now.getTime() + 1) }, now), true);
  assert.equal(isLive({ ...show, status: "live" }, now), true);
  assert.equal(isLive({ ...show, status: "canceled" }, now), false);
  assert.equal(isLive({ ...show, status: "live", confirmedUntil: now }, now), false);
  assert.equal(isLive({ ...show, status: "live", endedAt: now }, now), false);
});
test("canceled, expired, delayed and ended shows do not send stale reminders", () => {
  const now = centralInstant("2026-09-27");
  const show = { status: "confirmed", startsAt: now, endedAt: null, confirmedUntil: null };
  const post = { kind: "live", dueAt: now, expiresAt: new Date(now.getTime() + 3600000) };
  assert.equal(campaignDecision(post, show, now), "wait");
  assert.equal(campaignDecision(post, { ...show, status: "live", confirmedUntil: post.expiresAt }, now), "ready");
  assert.equal(campaignDecision(post, { ...show, status: "canceled" }, now), "canceled");
  assert.equal(campaignDecision(post, show, new Date(post.expiresAt.getTime() + 1)), "expired");
  assert.equal(campaignDecision({ ...post, kind: "preview" }, { ...show, status: "ended", endedAt: now }, now), "canceled");
});
test("campaign pack has local schedule and no automatic referral invitations", () => {
  const posts = campaignPack({ id: "show-one", title: "Garage finds", startsAt: centralInstant("2026-11-01") });
  assert.equal(posts.find(p => p.kind === "preview")!.dueAt.toISOString(), "2026-11-02T00:30:00.000Z");
  assert.equal(posts.find(p => p.kind === "countdown")!.dueAt.toISOString(), "2026-11-02T02:15:00.000Z");
  for (const p of posts) assert.doesNotThrow(() => assertAutomatedCopy(p.caption));
  for (const caption of ["https://www.whatnot.com/invite/treasure_hauls", "https://www.tolley.io/go/whatnot", "Get referral credit"]) assert.throws(() => assertAutomatedCopy(caption));
});
test("CSV handles quoted commas and newlines; prices never silently parse malformed input", () => {
  const parsed = parseSalesCsv('\uFEFFItem,Price,Buyer\r\n"Pan, large","$1,234.50",private\r\n"Multi\nline",0,private');
  assert.deepEqual(parsed.headers, ["Item", "Price", "Buyer"]);
  assert.equal(parsed.rows[0][0], "Pan, large"); assert.equal(parsed.rows[1][0], "Multi\nline");
  assert.equal(saleAmount(parsed.rows[0][1]), 1234.5);
  for (const value of ["", "-$3", "12junk", "1.234", "NaN"]) assert.throws(() => saleAmount(value));
  assert.throws(() => parseSalesCsv('Item,Price\n"unfinished,1'));
});
