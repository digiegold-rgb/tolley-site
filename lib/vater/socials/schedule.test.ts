import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { dripRequestId, enumerateDripSlots, parseTimeOfDay, wallClock } from "./schedule.ts";

describe("parseTimeOfDay", () => {
  it("reads HH:mm and clamps", () => {
    assert.deepEqual(parseTimeOfDay("09:30"), { hh: 9, mm: 30 });
    assert.deepEqual(parseTimeOfDay("9:05"), { hh: 9, mm: 5 });
    assert.deepEqual(parseTimeOfDay("bogus"), { hh: 9, mm: 0 });
  });
});

describe("enumerateDripSlots", () => {
  it("spreads at perDay cadence at timeOfDay in tz", () => {
    const slots = enumerateDripSlots({
      startAt: new Date("2026-09-01T14:00:00.000Z"),
      timezone: "UTC",
      perDay: 2,
      timeOfDay: "09:00",
      count: 5,
    });
    assert.equal(slots.length, 5);
    assert.equal(slots[0].wallClock.endsWith("T09:00:00"), true);
    assert.equal(slots[0].index, 0);
    assert.equal(slots[1].wallClock, slots[0].wallClock);
    assert.notEqual(slots[2].wallClock, slots[0].wallClock);
    const day0 = slots[0].wallClock.slice(0, 10);
    const day1 = slots[2].wallClock.slice(0, 10);
    const day2 = slots[4].wallClock.slice(0, 10);
    assert.notEqual(day0, day1);
    assert.notEqual(day1, day2);
  });

  it("does not schedule in the past of startAt", () => {
    const slots = enumerateDripSlots({
      startAt: new Date("2026-09-01T18:00:00.000Z"),
      timezone: "UTC",
      perDay: 1,
      timeOfDay: "09:00",
      count: 1,
    });
    assert.equal(slots.length, 1);
    assert.ok(slots[0].at.getTime() > Date.parse("2026-09-01T18:00:00.000Z"));
  });

  it("returns empty for count 0", () => {
    assert.deepEqual(
      enumerateDripSlots({
        startAt: new Date(),
        timezone: "UTC",
        perDay: 1,
        timeOfDay: "09:00",
        count: 0,
      }),
      [],
    );
  });
});

describe("dripRequestId", () => {
  it("is stable per batch index", () => {
    assert.equal(dripRequestId("abc", 0), "drip:abc:0");
    assert.equal(dripRequestId("abc", 3), "drip:abc:3");
  });
});

describe("wallClock", () => {
  it("formats in the given tz", () => {
    const s = wallClock("2026-09-01T14:30:00.000Z", "UTC");
    assert.equal(s, "2026-09-01T14:30:00");
  });
});
