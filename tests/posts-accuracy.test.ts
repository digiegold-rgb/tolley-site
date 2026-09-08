import assert from "node:assert/strict";
import test from "node:test";
import { activityTotal, DAY_MS, postIdentity, staleMetric, uniquePostRows } from "../lib/posts-accuracy";
import { channelWindows } from "../lib/view-counter-windows";

const now = Date.parse("2026-09-08T20:00:00Z");
const row = (day: string, totalViews: number | null, dayViews: number | null = null, pulled = `${day}T22:00:00Z`) => ({
  id: day, day: new Date(day), totalViews, dayViews, subscribers: null, pulledAt: new Date(pulled),
});
test("one fresh channel cannot make missing, stale, or zero-only partial channels complete", () => {
  const total = activityTotal([
    { views: 40, partial: false, since: null, method: "daily" },
    { views: 4000, partial: false, since: null, stale: true, method: "counter-change" },
    { views: null, partial: true, since: null, method: "unavailable" },
    { views: 0, partial: true, since: null, method: "daily" },
  ]);
  assert.deepEqual(total, { views: 40, partial: true, included: 2, excluded: 2, approximate: false });
  assert.equal(activityTotal([{ views: null, partial: true, since: null }]).views, null);
});
test("a recent backfill does not freshen an August counter", () => {
  const w = channelWindows([row("2026-08-09", 100), row("2026-08-13", 300, null, new Date(now).toISOString())], [], { platform: "tiktok" }, now).windows.d30;
  assert.equal(w.views, 200);
  assert.equal(w.stale, true);
  assert.equal(w.partial, true);
  assert.equal(activityTotal([w]).views, null);
});
test("upload lifetime views never masquerade as views received this month", () => {
  const w = channelWindows([], [{ videoId: "one", title: "old upload", publishedAt: new Date("2026-08-15"), views: 4000, pulledAt: new Date(now) }], { platform: "facebook" }, now).windows.d30;
  assert.equal(w.views, null);
  assert.equal(w.method, "unavailable");
});
test("changing X timeline samples cannot be treated as date-window activity", () => {
  const w = channelWindows([row("2026-08-09", 100), row("2026-09-08", 900, null, new Date(now).toISOString())], [], { platform: "x" }, now).windows.d30;
  assert.equal(w.views, null);
  assert.equal(w.method, "unavailable");
});
test("complete daily data excludes today's unfinished day and follows UTC boundaries", () => {
  const today = Math.floor(now / DAY_MS) * DAY_MS;
  const rows = Array.from({ length: 31 }, (_,i) => row(new Date(today - (30-i)*DAY_MS).toISOString().slice(0,10), null, i === 30 ? 9999 : 2, new Date(now).toISOString()));
  const w = channelWindows(rows, [], { platform: "youtube" }, now).windows.d30;
  assert.equal(w.views, 60);
  assert.equal(w.partial, false);
  assert.equal(w.through, "2026-09-07");
  assert.equal(channelWindows(rows.filter((_,i)=>i!==12), [], { platform: "youtube" }, now).windows.d30.partial, true);
});
test("counter decreases become unknown rather than a fabricated zero", () => {
  const w = channelWindows([row("2026-08-09", 1000), row("2026-09-08", 200, null, new Date(now).toISOString())], [], { platform: "tiktok" }, now).windows.d30;
  assert.equal(w.views, null);
  assert.equal(w.method, "unavailable");
});
test("account repoint clamp prevents another account's baseline entering a delta", () => {
  const w = channelWindows([row("2026-08-09", 4000000), row("2026-08-20", 100), row("2026-09-08", 300, null, new Date(now).toISOString())], [], { platform: "youtube", rowsSince: "2026-08-20" }, now).windows.d30;
  assert.equal(w.views, 200);
  assert.equal(w.partial, true);
});
test("exact retry reports collapse while separate titles, links, statuses and costs survive", () => {
  const base = { job: "pins", runId: "batch", channel: "pin", status: "ok", title: "Item A", firedAt: "2026-09-08T10:00:00Z", costCents: 0 };
  const rows = [base, { ...base }, { ...base, title: "Item B" }, { ...base, url: "https://example.com/second" }, { ...base, status: "fail" }, { ...base, costCents: 21 }];
  assert.equal(uniquePostRows(rows).length, 5);
  assert.equal(postIdentity({ ...base, firedAt: null }), postIdentity({ ...base, firedAt: undefined }));
});
test("unknown and future timestamps cannot pass freshness checks", () => {
  assert.equal(staleMetric(null, now), true);
  assert.equal(staleMetric("invalid", now), true);
  assert.equal(staleMetric(new Date(now+DAY_MS), now), true);
  assert.equal(staleMetric(new Date(now-1000), now), false);
});
